import cron from 'node-cron';
import { JiraAuthService } from './auth-service.js';
import { JiraApiService } from './jira-api.js';
import { ComprehensiveJiraSync } from './comprehensive-sync.js';
import { getDatabase } from './database.js';

export class TokenRefreshScheduler {
  constructor() {
    this.authService = new JiraAuthService();
    this.isRunning = false;
  }

  /**
   * Start the token refresh scheduler
   */
  start() {
    console.log('🕐 Starting token refresh scheduler...');
    
    // Check and refresh tokens every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.refreshAllTokens();
    });

    // Sync data every hour
    cron.schedule('0 * * * *', async () => {
      await this.syncAllData();
    });

    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.healthCheck();
    });

    console.log('✅ Scheduler started successfully');
  }

  /**
   * Refresh all tokens that need refreshing
   */
  async refreshAllTokens() {
    if (this.isRunning) {
      console.log('⏳ Token refresh already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting token refresh cycle...');

    try {
      const db = await getDatabase();
      const integrations = await db.all(
        'SELECT * FROM integrations WHERE is_active = 1'
      );

      for (const integration of integrations) {
        try {
          if (this.authService.needsRefresh(integration)) {
            console.log(`🔄 Refreshing tokens for integration ${integration.id}...`);
            
            const newTokens = await this.authService.refreshAccessToken(integration.id);
            console.log(`✅ Tokens refreshed for integration ${integration.id}`);
          } else {
            console.log(`✅ Integration ${integration.id} tokens are still valid`);
          }
        } catch (error) {
          console.error(`❌ Failed to refresh tokens for integration ${integration.id}:`, error.message);
          
          // Mark integration as inactive if refresh fails too many times
          if (integration.refresh_failures >= 3) {
            await db.run(
              'UPDATE integrations SET is_active = 0 WHERE id = ?',
              [integration.id]
            );
            console.log(`🚫 Deactivated integration ${integration.id} due to repeated failures`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during token refresh cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync all data for active integrations
   */
  async syncAllData() {
    console.log('🔄 Starting data sync cycle...');

    try {
      const db = await getDatabase();
      const integrations = await db.all(
        'SELECT * FROM integrations WHERE is_active = 1'
      );

      for (const integration of integrations) {
        try {
          console.log(`🔄 Syncing data for integration ${integration.id}...`);
          
          // Get accessible resources
          const apiService = new JiraApiService(integration.access_token, integration.base_url || 'https://api.atlassian.com');
          const resources = await apiService.getAccessibleResources();
          
          for (const resource of resources) {
            const cloudId = resource.id;
            const baseUrl = resource.url;
            
            // Get projects for this cloud
            const projects = await apiService.getProjects(cloudId);
            
            for (const project of projects) {
              // Store project info
              await db.run(`
                INSERT OR REPLACE INTO jira_projects 
                (integration_id, project_key, project_name, cloud_id, is_active)
                VALUES (?, ?, ?, ?, ?)
              `, [
                integration.id,
                project.key,
                project.name,
                cloudId,
                1
              ]);

              // Sync issues for this project
              const projectId = await db.get(
                'SELECT id FROM jira_projects WHERE integration_id = ? AND project_key = ?',
                [integration.id, project.key]
              );

              if (projectId) {
                await apiService.syncIssuesToDatabase(
                  integration.id,
                  projectId.id,
                  cloudId,
                  project.key
                );
              }
            }
          }
          
          console.log(`✅ Data sync completed for integration ${integration.id}`);
        } catch (error) {
          console.error(`❌ Failed to sync data for integration ${integration.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('❌ Error during data sync cycle:', error);
    }
  }

  /**
   * Health check for all integrations
   */
  async healthCheck() {
    console.log('🏥 Running health check...');

    try {
      const db = await getDatabase();
      const integrations = await db.all(
        'SELECT * FROM integrations WHERE is_active = 1'
      );

      for (const integration of integrations) {
        try {
          const apiService = new JiraApiService(integration.access_token, integration.base_url || 'https://api.atlassian.com');
          await apiService.getAccessibleResources();
          console.log(`✅ Integration ${integration.id} is healthy`);
        } catch (error) {
          console.warn(`⚠️ Integration ${integration.id} health check failed:`, error.message);
          
          // If it's a 401 error, try to refresh the token
          if (error.message.includes('401')) {
            console.log(`🔄 Attempting token refresh for integration ${integration.id}...`);
            try {
              await this.authService.refreshAccessToken(integration.id);
              console.log(`✅ Token refreshed for integration ${integration.id}`);
            } catch (refreshError) {
              console.error(`❌ Token refresh failed for integration ${integration.id}:`, refreshError.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during health check:', error);
    }
  }

  /**
   * Manual sync for a specific integration
   */
  async manualSync(integrationId) {
    console.log(`🔄 Manual sync for integration ${integrationId}...`);
    
    try {
      const db = await getDatabase();
      const integration = await db.get(
        'SELECT * FROM integrations WHERE id = ? AND is_active = 1',
        [integrationId]
      );

      if (!integration) {
        throw new Error('Integration not found or inactive');
      }

      // Get the real cloud ID from Jira API
      const { JiraApiService } = await import('./jira-api.js');
      const apiService = new JiraApiService(integration.access_token);
      const resources = await apiService.getAccessibleResources();
      
      if (resources.length === 0) {
        throw new Error('No accessible Jira resources found');
      }
      
      // Use the first accessible resource
      const cloudId = resources[0].id;
      console.log(`🔍 Using cloud ID: ${cloudId}`);
      
      const syncService = new ComprehensiveJiraSync(integration.access_token, cloudId);
      await syncService.syncAllData(parseInt(integrationId));

      console.log(`✅ Manual sync completed for integration ${integrationId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Manual sync failed for integration ${integrationId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

