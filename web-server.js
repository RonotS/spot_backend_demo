import express from 'express';
import { getDatabase } from './database.js';
import { JiraAuthService } from './auth-service.js';
import { TokenRefreshScheduler } from './scheduler.js';
import { ComprehensiveJiraSync } from './comprehensive-sync.js';

export class WebServer {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.authService = new JiraAuthService();
    this.scheduler = new TokenRefreshScheduler();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // OAuth callback endpoint
    this.app.get('/auth/callback', async (req, res) => {
      try {
        const { code, state } = req.query;
        
        if (!code) {
          return res.status(400).json({ error: 'No authorization code provided' });
        }

        console.log('🔄 Processing OAuth callback...');
        
        // Exchange code for tokens
        const tokens = await this.authService.exchangeCodeForTokens(code);
        
        // Use stored account info or defaults
        const accountInfo = this.tempAccountInfo || {
          accountName: 'New Jira Account',
          accountEmail: 'user@example.com',
          jiraDomain: 'your-domain.atlassian.net'
        };
        
        // Store tokens in database with account info
        const integrationId = await this.authService.storeTokens('web-auth', tokens, accountInfo);
        
        // Clear temporary account info
        this.tempAccountInfo = null;
        
        res.json({
          success: true,
          message: 'Authentication completed successfully!',
          integrationId,
          redirectUrl: '/dashboard'
        });
      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Start authentication
    this.app.post('/auth/start', async (req, res) => {
      try {
        const { projectId = 'web-auth' } = req.body;
        
        const state = `web-auth-${Date.now()}`;
        const authUrl = this.authService.generateOAuthUrl(state);
        
        res.json({
          success: true,
          authUrl,
          message: 'Please complete OAuth flow in the browser'
        });
      } catch (error) {
        console.error('❌ Auth start error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Start authentication with account info
    this.app.post('/auth/start-with-account', async (req, res) => {
      try {
        const { accountName, accountEmail, jiraDomain } = req.body;
        
        // Store account info temporarily
        this.tempAccountInfo = { accountName, accountEmail, jiraDomain };
        
        const state = `account-${Date.now()}-${accountName}`;
        const authUrl = this.authService.generateOAuthUrl(state);
        
        res.json({
          success: true,
          authUrl,
          message: 'Please complete OAuth flow in the browser'
        });
      } catch (error) {
        console.error('❌ Auth start error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get all integrations
    this.app.get('/api/integrations', async (req, res) => {
      try {
        const { accountId } = req.query;
        const db = await getDatabase();
        
        let query = 'SELECT id, project_id, expires_at, last_refresh_at, refresh_failures, is_active, created_at FROM integrations';
        let params = [];
        
        if (accountId) {
          query += ' WHERE id = ?';
          params.push(accountId);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const integrations = await db.all(query, params);
        
        res.json({ integrations });
      } catch (error) {
        console.error('❌ Get integrations error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current account info
    this.app.get('/api/current-account', async (req, res) => {
      try {
        const db = await getDatabase();
        const currentAccount = await db.get(
          'SELECT * FROM integrations WHERE is_primary = 1 AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
        );
        
        if (!currentAccount) {
          return res.json({ account: null, message: 'No primary account found' });
        }
        
        res.json({ account: currentAccount });
      } catch (error) {
        console.error('❌ Error fetching current account:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get projects for an integration
    this.app.get('/api/integrations/:id/projects', async (req, res) => {
      try {
        const { id } = req.params;
        const db = await getDatabase();
        
        const projects = await db.all(
          'SELECT * FROM jira_projects WHERE integration_id = ? AND is_active = 1',
          [id]
        );
        
        res.json({ projects });
      } catch (error) {
        console.error('❌ Get projects error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get issues for a project
    this.app.get('/api/projects/:id/issues', async (req, res) => {
      try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const db = await getDatabase();
        
        const issues = await db.all(
          `SELECT * FROM jira_issues 
           WHERE project_id = ? 
           ORDER BY updated_at DESC 
           LIMIT ? OFFSET ?`,
          [id, parseInt(limit), parseInt(offset)]
        );
        
        res.json({ issues });
      } catch (error) {
        console.error('❌ Get issues error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Manual sync
    this.app.post('/api/integrations/:id/sync', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.scheduler.manualSync(parseInt(id));
        
        if (result.success) {
          res.json({ success: true, message: 'Sync completed successfully' });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        console.error('❌ Manual sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Individual sync endpoints
    this.app.post('/api/integrations/:id/sync/projects', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'projects');
        res.json(result);
      } catch (error) {
        console.error('❌ Projects sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/issue-types', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'issue-types');
        res.json(result);
      } catch (error) {
        console.error('❌ Issue types sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/priorities', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'priorities');
        res.json(result);
      } catch (error) {
        console.error('❌ Priorities sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/statuses', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'statuses');
        res.json(result);
      } catch (error) {
        console.error('❌ Statuses sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/resolutions', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'resolutions');
        res.json(result);
      } catch (error) {
        console.error('❌ Resolutions sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/users', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'users');
        res.json(result);
      } catch (error) {
        console.error('❌ Users sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/groups', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'groups');
        res.json(result);
      } catch (error) {
        console.error('❌ Groups sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/fields', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'fields');
        res.json(result);
      } catch (error) {
        console.error('❌ Fields sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/labels', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'labels');
        res.json(result);
      } catch (error) {
        console.error('❌ Labels sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/components', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'components');
        res.json(result);
      } catch (error) {
        console.error('❌ Components sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/versions', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'versions');
        res.json(result);
      } catch (error) {
        console.error('❌ Versions sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/workflows', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'workflows');
        res.json(result);
      } catch (error) {
        console.error('❌ Workflows sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/dashboards', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'dashboards');
        res.json(result);
      } catch (error) {
        console.error('❌ Dashboards sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/filters', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'filters');
        res.json(result);
      } catch (error) {
        console.error('❌ Filters sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/permissions', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'permissions');
        res.json(result);
      } catch (error) {
        console.error('❌ Permissions sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/issues', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'issues');
        res.json(result);
      } catch (error) {
        console.error('❌ Issues sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/comments', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'comments');
        res.json(result);
      } catch (error) {
        console.error('❌ Comments sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/worklogs', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'worklogs');
        res.json(result);
      } catch (error) {
        console.error('❌ Worklogs sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/attachments', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'attachments');
        res.json(result);
      } catch (error) {
        console.error('❌ Attachments sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/integrations/:id/sync/issue-links', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.syncIndividualData(parseInt(id), 'issue-links');
        res.json(result);
      } catch (error) {
        console.error('❌ Issue links sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Token refresh endpoint
    this.app.post('/api/integrations/:id/refresh-token', async (req, res) => {
      try {
        const { id } = req.params;
        console.log(`🔄 Manual token refresh requested for integration ${id}...`);
        
        const db = await getDatabase();
        const integration = await db.get('SELECT * FROM integrations WHERE id = ? AND is_active = 1', [id]);
        
        if (!integration) {
          console.log(`❌ Integration ${id} not found or inactive`);
          return res.status(404).json({ error: 'Integration not found or inactive' });
        }

        // Show current token status
        const expiresAt = new Date(integration.expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt - now;
        const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
        const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));
        
        console.log(`📊 Current token status for integration ${id}:`);
        console.log(`   - Expires: ${integration.expires_at}`);
        console.log(`   - Time until expiry: ${hoursUntilExpiry}h ${minutesUntilExpiry % 60}m`);
        console.log(`   - Last refresh: ${integration.last_refresh_at}`);
        console.log(`   - Refresh failures: ${integration.refresh_failures || 0}`);

        // Attempt token refresh
        console.log(`🔄 Attempting token refresh for integration ${id}...`);
        const authService = new JiraAuthService();
        
        try {
          const newTokens = await authService.refreshAccessToken(parseInt(id));
          console.log(`✅ Token refresh successful for integration ${id}!`);
          console.log(`   - New expiry: ${newTokens.expiresAt}`);
          
          // Get updated integration data
          const updatedIntegration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
          const newExpiresAt = new Date(updatedIntegration.expires_at);
          const newTimeUntilExpiry = newExpiresAt - new Date();
          const newHoursUntilExpiry = Math.round(newTimeUntilExpiry / (1000 * 60 * 60));
          
          console.log(`📊 Updated token info:`);
          console.log(`   - New expiry: ${updatedIntegration.expires_at}`);
          console.log(`   - Time until expiry: ${newHoursUntilExpiry}h`);
          console.log(`   - Last refresh: ${updatedIntegration.last_refresh_at}`);
          console.log(`   - Refresh failures: ${updatedIntegration.refresh_failures || 0}`);
          
          res.json({ 
            success: true, 
            message: 'Token refreshed successfully',
            expiresAt: updatedIntegration.expires_at,
            lastRefresh: updatedIntegration.last_refresh_at,
            hoursUntilExpiry: newHoursUntilExpiry
          });
          
        } catch (refreshError) {
          console.log(`❌ Token refresh failed for integration ${id}: ${refreshError.message}`);
          
          // Get updated integration data
          const updatedIntegration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
          
          // Check if it's a "no refresh token" error
          if (refreshError.message.includes('No refresh token available')) {
            res.status(500).json({ 
              success: false, 
              error: refreshError.message,
              requiresReauth: true,
              message: 'No refresh token available. Please re-authenticate to get a new refresh token.',
              refreshFailures: updatedIntegration.refresh_failures
            });
          } else {
            res.status(500).json({ 
              success: false, 
              error: refreshError.message,
              requiresReauth: false,
              message: 'Token refresh failed. Please try again.',
              refreshFailures: updatedIntegration.refresh_failures
            });
          }
        }
        
      } catch (error) {
        console.error('❌ Token refresh error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Comprehensive sync
    this.app.post('/api/integrations/:id/comprehensive-sync', async (req, res) => {
      try {
        const { id } = req.params;
        const db = await getDatabase();
        
        // Get integration details
        const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [id]);
        if (!integration) {
          return res.status(404).json({ error: 'Integration not found' });
        }

        // Get the real cloud ID from Jira API
        const { JiraApiService } = await import('./jira-api.js');
        const apiService = new JiraApiService(integration.access_token);
        const resources = await apiService.getAccessibleResources();
        
        if (resources.length === 0) {
          return res.status(400).json({ error: 'No accessible Jira resources found' });
        }
        
        // Use the first accessible resource
        const cloudId = resources[0].id;
        console.log(`🔍 Using cloud ID: ${cloudId}`);
        
        const syncService = new ComprehensiveJiraSync(integration.access_token, cloudId);
        await syncService.syncAllData(parseInt(id));
        
        res.json({ success: true, message: 'Comprehensive sync completed successfully' });
      } catch (error) {
        console.error('❌ Comprehensive sync error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get comprehensive data statistics
    this.app.get('/api/integrations/:id/stats', async (req, res) => {
      try {
        const { id } = req.params;
        const db = await getDatabase();
        
        const stats = {};
        
        // Count records in each table for this specific integration
        const tables = [
          'jira_projects', 'jira_issue_types', 'jira_priorities', 'jira_statuses',
          'jira_resolutions', 'jira_users', 'jira_groups', 'jira_fields',
          'jira_labels', 'jira_components', 'jira_versions', 'jira_workflows',
          'jira_dashboards', 'jira_filters', 'jira_permissions', 'jira_issues',
          'jira_comments', 'jira_worklogs', 'jira_attachments', 'jira_issue_links'
        ];
        
        for (const table of tables) {
          try {
            const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE integration_id = ?`, [id]);
            stats[table] = result.count;
          } catch (error) {
            stats[table] = 0;
          }
        }
        
        res.json({ stats });
      } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get raw data for visualization
    this.app.get('/api/integrations/:id/raw-data', async (req, res) => {
      try {
        const { id } = req.params;
        const { table, limit = 100 } = req.query;
        const db = await getDatabase();
        
        if (!table) {
          return res.status(400).json({ error: 'Table parameter required' });
        }
        
        const data = await db.all(
          `SELECT * FROM ${table} WHERE integration_id = ? ORDER BY id DESC LIMIT ?`,
          [id, parseInt(limit)]
        );
        
        res.json({ data, count: data.length });
      } catch (error) {
        console.error('❌ Get raw data error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Multi-account management endpoints
    this.app.get('/api/accounts', async (req, res) => {
      try {
        const db = await getDatabase();
        const accounts = await db.all(`
          SELECT id, account_name, account_email, jira_domain, is_primary, is_active, 
                 created_at, last_refresh_at, expires_at
          FROM integrations 
          ORDER BY is_primary DESC, created_at DESC
        `);
        
        res.json({ accounts });
      } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/accounts/:id/set-primary', async (req, res) => {
      try {
        const { id } = req.params;
        const db = await getDatabase();
        
        // Remove primary status from all accounts
        await db.run('UPDATE integrations SET is_primary = 0');
        
        // Set this account as primary
        await db.run('UPDATE integrations SET is_primary = 1 WHERE id = ?', [id]);
        
        console.log(`✅ Account ${id} set as primary`);
        res.json({ success: true, message: 'Primary account updated' });
      } catch (error) {
        console.error('❌ Error setting primary account:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.delete('/api/accounts/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const db = await getDatabase();
        
        // Deactivate the integration
        await db.run('UPDATE integrations SET is_active = 0 WHERE id = ?', [id]);
        
        console.log(`✅ Account ${id} deactivated`);
        res.json({ success: true, message: 'Account deactivated' });
      } catch (error) {
        console.error('❌ Error deactivating account:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Multi-account dashboard route
    this.app.get('/accounts', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Jira Multi-Account Manager</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #0056b3; }
            .btn-success { background: #28a745; }
            .btn-warning { background: #ffc107; color: #000; }
            .btn-danger { background: #dc3545; }
            .btn-primary { background: #007bff; }
            .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .primary-badge { background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .active-badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .inactive-badge { background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .nav-links { display: flex; gap: 20px; }
            .nav-links a { color: #007bff; text-decoration: none; font-weight: bold; }
            .nav-links a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔗 Jira Multi-Account Manager</h1>
              <div class="nav-links">
                <a href="/dashboard">📊 Main Dashboard</a>
                <a href="/accounts">👥 Account Manager</a>
                <a href="/health">🏥 Health Check</a>
              </div>
            </div>
            
            <div class="card">
              <h2>👥 Manage Jira Accounts</h2>
              <p>Add and manage multiple Jira account integrations. Switch between accounts and set a primary account.</p>
              
              <div style="margin: 20px 0;">
                <button class="btn btn-success" onclick="showAddAccountForm()">➕ Add New Jira Account</button>
                <button class="btn btn-primary" onclick="loadAccounts()">🔄 Refresh Accounts</button>
              </div>
              
              <div id="add-account-form" style="display: none; margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa;">
                <h3>Add New Jira Account</h3>
                <form id="account-form">
                  <div style="margin: 10px 0;">
                    <label for="accountName">Account Name:</label><br>
                    <input type="text" id="accountName" name="accountName" placeholder="e.g., Company Jira Account" style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
                  </div>
                  <div style="margin: 10px 0;">
                    <label for="accountEmail">Account Email:</label><br>
                    <input type="email" id="accountEmail" name="accountEmail" placeholder="e.g., user@company.com" style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
                  </div>
                  <div style="margin: 10px 0;">
                    <label for="jiraDomain">Jira Domain:</label><br>
                    <input type="text" id="jiraDomain" name="jiraDomain" placeholder="e.g., company.atlassian.net" style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
                  </div>
                  <div style="margin: 10px 0;">
                    <button type="button" class="btn btn-success" onclick="startNewAuth()">🚀 Start OAuth Flow</button>
                    <button type="button" class="btn" onclick="hideAddAccountForm()">Cancel</button>
                  </div>
                </form>
              </div>
              
              <div id="accounts-list">
                <p>Loading accounts...</p>
              </div>
            </div>
          </div>

          <script>
            async function loadAccounts() {
              try {
                const response = await fetch('/api/accounts');
                const data = await response.json();
                
                if (data.accounts.length === 0) {
                  document.getElementById('accounts-list').innerHTML = '<p>No accounts found. Add your first Jira account!</p>';
                  return;
                }
                
                let html = '<table><tr><th>Account</th><th>Email</th><th>Domain</th><th>Status</th><th>Primary</th><th>Last Refresh</th><th>Actions</th></tr>';
                
                data.accounts.forEach(account => {
                  const status = account.is_active ? '🟢 Active' : '🔴 Inactive';
                  const primary = account.is_primary ? '<span class="primary-badge">⭐ PRIMARY</span>' : '';
                  const lastRefresh = account.last_refresh_at ? new Date(account.last_refresh_at).toLocaleString() : 'Never';
                  
                  html += \`<tr>
                    <td><strong>\${account.account_name}</strong></td>
                    <td>\${account.account_email}</td>
                    <td>\${account.jira_domain}</td>
                    <td>\${status}</td>
                    <td>\${primary}</td>
                    <td>\${lastRefresh}</td>
                    <td>
                      <button class="btn btn-primary" onclick="setPrimary(\${account.id})" \${account.is_primary ? 'disabled' : ''}>Set Primary</button>
                      <button class="btn btn-warning" onclick="viewAccount(\${account.id})">View Details</button>
                      <button class="btn btn-danger" onclick="deactivateAccount(\${account.id})" \${!account.is_active ? 'disabled' : ''}>Deactivate</button>
                    </td>
                  </tr>\`;
                });
                
                html += '</table>';
                document.getElementById('accounts-list').innerHTML = html;
                
              } catch (error) {
                document.getElementById('accounts-list').innerHTML = '<p class="error">Error loading accounts: ' + error.message + '</p>';
              }
            }
            
            async function setPrimary(accountId) {
              try {
                const response = await fetch(\`/api/accounts/\${accountId}/set-primary\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Primary account updated successfully!');
                  loadAccounts();
                } else {
                  alert('Error: ' + data.error);
                }
              } catch (error) {
                alert('Error setting primary account: ' + error.message);
              }
            }
            
            async function deactivateAccount(accountId) {
              if (!confirm('Are you sure you want to deactivate this account?')) return;
              
              try {
                const response = await fetch(\`/api/accounts/\${accountId}\`, { method: 'DELETE' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Account deactivated successfully!');
                  loadAccounts();
                } else {
                  alert('Error: ' + data.error);
                }
              } catch (error) {
                alert('Error deactivating account: ' + error.message);
              }
            }
            
            function viewAccount(accountId) {
              window.location.href = \`/dashboard?account=\${accountId}\`;
            }
            
            function showAddAccountForm() {
              document.getElementById('add-account-form').style.display = 'block';
            }
            
            function hideAddAccountForm() {
              document.getElementById('add-account-form').style.display = 'none';
            }
            
            async function startNewAuth() {
              const accountName = document.getElementById('accountName').value;
              const accountEmail = document.getElementById('accountEmail').value;
              const jiraDomain = document.getElementById('jiraDomain').value;
              
              if (!accountName || !accountEmail || !jiraDomain) {
                alert('Please fill in all fields');
                return;
              }
              
              try {
                const response = await fetch('/auth/start-with-account', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accountName, accountEmail, jiraDomain })
                });
                
                const data = await response.json();
                
                if (data.success) {
                  window.location.href = data.authUrl;
                } else {
                  alert('Error: ' + data.error);
                }
              } catch (error) {
                alert('Error starting OAuth: ' + error.message);
              }
            }
            
            // Load accounts on page load
            loadAccounts();
          </script>
        </body>
        </html>
      `);
    });

    // Dashboard route
    this.app.get('/dashboard', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Jira Backend Auth Demo - Comprehensive Data Sync</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #0056b3; }
            .btn-success { background: #28a745; }
            .btn-warning { background: #ffc107; color: #000; }
            .btn-danger { background: #dc3545; }
            .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid transparent; transition: all 0.3s ease; }
            .stat-card.clickable { cursor: pointer; }
            .stat-card.clickable:hover { background: #e9ecef; border-color: #007bff; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
            .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
            .stat-label { color: #666; margin-top: 5px; }
            .sync-indicator { font-size: 0.8em; margin-top: 5px; font-weight: bold; }
            .raw-data { max-height: 400px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 4px; }
            .json-viewer { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
            .loading { text-align: center; padding: 20px; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Jira Backend Auth Demo - Comprehensive Data Sync</h1>
            
            <div class="card">
              <h2>🔐 Authentication</h2>
              <button class="btn" onclick="startAuth()">Start OAuth Flow</button>
              <div id="auth-status"></div>
            </div>
            
            <div class="card">
              <h2>👥 Current Account</h2>
              <div id="current-account-info">
                <p>Loading current account...</p>
              </div>
              <div style="margin: 10px 0;">
                <button class="btn btn-success" onclick="window.location.href='/accounts'">Manage All Accounts</button>
                <button class="btn" onclick="loadAccounts()">Switch Account</button>
                <button class="btn" onclick="loadCurrentAccount()">Refresh Current Account</button>
              </div>
              <div id="account-selector" style="display: none;">
                <h3>Switch to Another Account:</h3>
                <div id="account-list"></div>
              </div>
            </div>
            
            <div class="card">
              <h2>🔗 Integrations</h2>
              <button class="btn" onclick="loadIntegrations()">Refresh</button>
              <div id="integrations"></div>
            </div>
            
            <div class="card">
              <h2>📊 Data Statistics</h2>
              <div id="stats-container">
                <div class="status info">
                  <p>No account selected. Please select an account first to see data statistics.</p>
                </div>
              </div>
            </div>
            
            <div class="card">
              <h2>🔍 Raw Data Explorer</h2>
              <div>
                <select id="table-select" onchange="loadRawData()">
                  <option value="">Select a table...</option>
                  <option value="jira_projects">Projects</option>
                  <option value="jira_issues">Issues</option>
                  <option value="jira_users">Users</option>
                  <option value="jira_issue_types">Issue Types</option>
                  <option value="jira_priorities">Priorities</option>
                  <option value="jira_statuses">Statuses</option>
                  <option value="jira_comments">Comments</option>
                  <option value="jira_worklogs">Worklogs</option>
                  <option value="jira_attachments">Attachments</option>
                  <option value="jira_components">Components</option>
                  <option value="jira_versions">Versions</option>
                  <option value="jira_labels">Labels</option>
                  <option value="jira_fields">Fields</option>
                </select>
                <button class="btn" onclick="loadRawData()">Load Data</button>
              </div>
              <div id="raw-data-container">
              <div class="status info">
                <p>No account selected. Please select an account first to explore raw data.</p>
              </div>
              </div>
            </div>
          </div>
          
          <script>
            let currentIntegrationId = null;
            
            async function startAuth() {
              try {
                const response = await fetch('/auth/start', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  document.getElementById('auth-status').innerHTML = 
                    '<div class="status success">✅ OAuth URL generated! <a href="' + data.authUrl + '" target="_blank">Click here to authenticate</a></div>';
                } else {
                  document.getElementById('auth-status').innerHTML = 
                    '<div class="status error">❌ ' + data.error + '</div>';
                }
              } catch (error) {
                document.getElementById('auth-status').innerHTML = 
                  '<div class="status error">❌ ' + error.message + '</div>';
              }
            }
            
            async function loadCurrentAccount() {
              try {
                const response = await fetch('/api/current-account');
                const data = await response.json();
                
                if (data.account) {
                  const account = data.account;
                  const status = account.is_active ? '🟢 Active' : '🔴 Inactive';
                  const primary = account.is_primary ? '⭐ PRIMARY' : '📋 SECONDARY';
                  
                  document.getElementById('current-account-info').innerHTML = \`
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                      <h3>\${account.account_name} \${primary}</h3>
                      <p><strong>Email:</strong> \${account.account_email}</p>
                      <p><strong>Domain:</strong> \${account.jira_domain}</p>
                      <p><strong>Status:</strong> \${status}</p>
                      <p><strong>Last Refresh:</strong> \${account.last_refresh_at ? new Date(account.last_refresh_at).toLocaleString() : 'Never'}</p>
                    </div>
                  \`;
                  
                  // Set current integration ID for data loading
                  currentIntegrationId = account.id;
                  
                  // Load account-specific data
                  loadIntegrations();
                  loadStats(account.id);
                } else {
                  document.getElementById('current-account-info').innerHTML = '<p>No account selected. <a href="/accounts">Add your first Jira account</a>!</p>';
                }
              } catch (error) {
                document.getElementById('current-account-info').innerHTML = '<p class="error">Error loading current account: ' + error.message + '</p>';
              }
            }
            
            async function loadAccounts() {
              try {
                const response = await fetch('/api/accounts');
                const data = await response.json();
                
                if (data.accounts.length === 0) {
                  document.getElementById('account-list').innerHTML = '<p>No accounts found. <a href="/accounts">Add your first Jira account</a>!</p>';
                  return;
                }
                
                let html = '<table><tr><th>Account</th><th>Email</th><th>Status</th><th>Primary</th><th>Actions</th></tr>';
                
                data.accounts.forEach(account => {
                  const status = account.is_active ? '🟢 Active' : '🔴 Inactive';
                  const primary = account.is_primary ? '<span style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px;">⭐ PRIMARY</span>' : '';
                  
                  html += \`<tr>
                    <td><strong>\${account.account_name}</strong></td>
                    <td>\${account.account_email}</td>
                    <td>\${status}</td>
                    <td>\${primary}</td>
                    <td>
                      <button class="btn btn-primary" onclick="switchToAccount(\${account.id})" \${!account.is_active ? 'disabled' : ''}>Switch To</button>
                      <button class="btn btn-warning" onclick="setPrimary(\${account.id})" \${account.is_primary ? 'disabled' : ''}>Set Primary</button>
                    </td>
                  </tr>\`;
                });
                
                html += '</table>';
                document.getElementById('account-list').innerHTML = html;
                
                // Show/hide account selector
                const selector = document.getElementById('account-selector');
                selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
                
              } catch (error) {
                document.getElementById('account-list').innerHTML = '<p class="error">Error loading accounts: ' + error.message + '</p>';
              }
            }
            
            async function switchToAccount(accountId) {
              try {
                // Set this account as primary
                const response = await fetch(\`/api/accounts/\${accountId}/set-primary\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Account switched successfully!');
                  // Reload current account and data
                  loadCurrentAccount();
                  // Hide account selector
                  document.getElementById('account-selector').style.display = 'none';
                } else {
                  alert('Failed to switch account: ' + data.error);
                }
              } catch (error) {
                alert('Error switching account: ' + error.message);
              }
            }
            
            async function setPrimary(accountId) {
              try {
                const response = await fetch(\`/api/accounts/\${accountId}/set-primary\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Primary account updated!');
                  loadCurrentAccount();
                  loadAccounts();
                } else {
                  alert('Failed to set primary account: ' + data.error);
                }
              } catch (error) {
                alert('Error setting primary account: ' + error.message);
              }
            }

            async function loadIntegrations() {
              try {
                // Load integrations for current account only
                const response = await fetch(\`/api/integrations?accountId=\${currentIntegrationId}\`);
                const data = await response.json();
                
                let html = '<table><tr><th>ID</th><th>Project</th><th>Status</th><th>Last Refresh</th><th>Expires At</th><th>Actions</th></tr>';
                
                data.integrations.forEach(integration => {
                  const status = integration.is_active ? 'Active' : 'Inactive';
                  const lastRefresh = integration.last_refresh_at ? new Date(integration.last_refresh_at).toLocaleString() : 'Never';
                  const expiresAt = integration.expires_at ? new Date(integration.expires_at).toLocaleString() : 'Unknown';
                  const timeUntilExpiry = integration.expires_at ? Math.round((new Date(integration.expires_at) - new Date()) / (1000 * 60 * 60)) : 0;
                  
                  let expiryStatus;
                  if (timeUntilExpiry > 0) {
                    const color = timeUntilExpiry < 2 ? 'red' : timeUntilExpiry < 24 ? 'orange' : 'green';
                    expiryStatus = '<span style="color: ' + color + '">' + timeUntilExpiry + 'h</span>';
                  } else {
                    expiryStatus = '<span style="color: red">Expired</span>';
                  }
                  
                  html += \`<tr>
                    <td>\${integration.id}</td>
                    <td>\${integration.project_id}</td>
                    <td>\${status}</td>
                    <td>\${lastRefresh}</td>
                    <td>\${expiresAt}<br><small>\${expiryStatus}</small></td>
                    <td>
                      <button class="btn" onclick="refreshToken(\${integration.id})">🔄 Refresh Token</button>
                      <button class="btn" onclick="syncIntegration(\${integration.id})">Quick Sync</button>
                      <button class="btn btn-success" onclick="comprehensiveSync(\${integration.id})">Full Sync</button>
                      <button class="btn btn-warning" onclick="loadStats(\${integration.id})">Stats</button>
                    </td>
                  </tr>\`;
                });
                
                html += '</table>';
                document.getElementById('integrations').innerHTML = html;
                
                // Set current integration ID for stats (use the latest one)
                if (data.integrations.length > 0) {
                  // Sort by ID descending to get the latest integration
                  const sortedIntegrations = data.integrations.sort((a, b) => b.id - a.id);
                  currentIntegrationId = sortedIntegrations[0].id;
                  loadStats(currentIntegrationId);
                } else {
                  // No integrations found - show empty state
                  document.getElementById('stats-container').innerHTML = 
                    '<div class="status info"><p>No integrations found for this account. Please authenticate first to see data statistics.</p></div>';
                }
              } catch (error) {
                document.getElementById('integrations').innerHTML = 
                  '<div class="status error">❌ ' + error.message + '</div>';
              }
            }
            
            async function syncIntegration(id) {
              try {
                const response = await fetch(\`/api/integrations/\${id}/sync\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Quick sync completed successfully!');
                  loadIntegrations();
                } else {
                  alert('Sync failed: ' + data.error);
                }
              } catch (error) {
                alert('Sync error: ' + error.message);
              }
            }
            
            async function comprehensiveSync(id) {
              try {
                const response = await fetch(\`/api/integrations/\${id}/comprehensive-sync\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert('Comprehensive sync completed successfully!');
                  loadIntegrations();
                  loadStats(id);
                } else {
                  alert('Comprehensive sync failed: ' + data.error);
                }
              } catch (error) {
                alert('Comprehensive sync error: ' + error.message);
              }
            }
            
            async function refreshToken(id) {
              try {
                console.log(\`🔄 Refreshing token for integration \${id}...\`);
                const response = await fetch(\`/api/integrations/\${id}/refresh-token\`, { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                  alert(\`✅ Token refreshed successfully!\\nNew expiry: \${data.expiresAt}\\nHours until expiry: \${data.hoursUntilExpiry}h\`);
                  loadIntegrations(); // Refresh the table to show updated expiry
                } else {
                  if (data.requiresReauth) {
                    const reauth = confirm(\`⚠️ \${data.message}\\n\\nIntegration \${id} needs re-authentication.\\n\\nWould you like to start a new OAuth flow?\`);
                    if (reauth) {
                      startAuth();
                    }
                  } else {
                    alert(\`❌ Token refresh failed: \${data.error}\\nRefresh failures: \${data.refreshFailures || 0}\`);
                  }
                  loadIntegrations(); // Refresh the table to show updated status
                }
              } catch (error) {
                alert('Token refresh error: ' + error.message);
                loadIntegrations(); // Refresh the table
              }
            }
            
            async function loadStats(integrationId) {
              try {
                currentIntegrationId = integrationId;
                const response = await fetch(\`/api/integrations/\${integrationId}/stats\`);
                
                if (!response.ok) {
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                
                let html = '<div class="stats-grid">';
                
                const tableNames = {
                  'jira_projects': 'Projects',
                  'jira_issues': 'Issues',
                  'jira_users': 'Users',
                  'jira_issue_types': 'Issue Types',
                  'jira_priorities': 'Priorities',
                  'jira_statuses': 'Statuses',
                  'jira_resolutions': 'Resolutions',
                  'jira_groups': 'Groups',
                  'jira_fields': 'Fields',
                  'jira_labels': 'Labels',
                  'jira_components': 'Components',
                  'jira_versions': 'Versions',
                  'jira_workflows': 'Workflows',
                  'jira_dashboards': 'Dashboards',
                  'jira_filters': 'Filters',
                  'jira_permissions': 'Permissions',
                  'jira_comments': 'Comments',
                  'jira_worklogs': 'Worklogs',
                  'jira_attachments': 'Attachments',
                  'jira_issue_links': 'Issue Links'
                };
                
                const syncEndpoints = {
                  'jira_projects': 'projects',
                  'jira_issues': 'issues',
                  'jira_users': 'users',
                  'jira_issue_types': 'issue-types',
                  'jira_priorities': 'priorities',
                  'jira_statuses': 'statuses',
                  'jira_resolutions': 'resolutions',
                  'jira_groups': 'groups',
                  'jira_fields': 'fields',
                  'jira_labels': 'labels',
                  'jira_components': 'components',
                  'jira_versions': 'versions',
                  'jira_workflows': 'workflows',
                  'jira_dashboards': 'dashboards',
                  'jira_filters': 'filters',
                  'jira_permissions': 'permissions',
                  'jira_comments': 'comments',
                  'jira_worklogs': 'worklogs',
                  'jira_attachments': 'attachments',
                  'jira_issue_links': 'issue-links'
                };
                
                for (const [table, count] of Object.entries(data.stats)) {
                  const displayName = tableNames[table] || table;
                  const syncEndpoint = syncEndpoints[table];
                  html += \`
                    <div class="stat-card clickable" onclick="syncIndividualData('\${syncEndpoint}', '\${displayName}')" title="Click to sync \${displayName}">
                      <div class="stat-number">\${count}</div>
                      <div class="stat-label">\${displayName}</div>
                      <div class="sync-indicator" id="sync-\${syncEndpoint}"></div>
                    </div>
                  \`;
                }
                
                html += '</div>';
                document.getElementById('stats-container').innerHTML = html;
              } catch (error) {
                document.getElementById('stats-container').innerHTML = 
                  '<div class="status error">❌ ' + error.message + '</div>';
              }
            }
            
            async function syncIndividualData(endpoint, displayName) {
              if (!currentIntegrationId) {
                alert('Please select an account first');
                return;
              }
              
              const indicator = document.getElementById(\`sync-\${endpoint}\`);
              if (indicator) {
                indicator.innerHTML = '🔄 Syncing...';
                indicator.style.color = '#007bff';
              }
              
              try {
                const response = await fetch(\`/api/integrations/\${currentIntegrationId}/sync/\${endpoint}\`, { 
                  method: 'POST' 
                });
                const data = await response.json();
                
                if (data.success) {
                  if (indicator) {
                    indicator.innerHTML = '✅ Synced';
                    indicator.style.color = '#28a745';
                  }
                  // Refresh the stats to show updated counts
                  setTimeout(() => {
                    loadStats(currentIntegrationId);
                  }, 1000);
                } else {
                  if (indicator) {
                    indicator.innerHTML = '❌ Failed';
                    indicator.style.color = '#dc3545';
                  }
                  alert(\`Sync failed for \${displayName}: \${data.error}\`);
                }
              } catch (error) {
                if (indicator) {
                  indicator.innerHTML = '❌ Error';
                  indicator.style.color = '#dc3545';
                }
                alert(\`Sync error for \${displayName}: \${error.message}\`);
              }
            }
            
            async function loadRawData() {
              if (!currentIntegrationId) {
                alert('Please select an account first');
                return;
              }
              
              const table = document.getElementById('table-select').value;
              if (!table) {
                alert('Please select a table');
                return;
              }
              
              try {
                document.getElementById('raw-data-container').innerHTML = 
                  '<div class="loading"><div class="spinner"></div><p>Loading data...</p></div>';
                
                const response = await fetch(\`/api/integrations/\${currentIntegrationId}/raw-data?table=\${table}&limit=50\`);
                const data = await response.json();
                
                let html = \`<h3>\${table} (\${data.count} records)</h3>\`;
                
                if (data.data.length > 0) {
                  html += '<div class="raw-data">';
                  data.data.forEach((record, index) => {
                    html += \`<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                      <h4>Record \${index + 1}</h4>
                      <div class="json-viewer">\${JSON.stringify(record, null, 2)}</div>
                    </div>\`;
                  });
                  html += '</div>';
                } else {
                  html += '<div class="status info">No data found for this table</div>';
                }
                
                document.getElementById('raw-data-container').innerHTML = html;
              } catch (error) {
                document.getElementById('raw-data-container').innerHTML = 
                  '<div class="status error">❌ ' + error.message + '</div>';
              }
            }
            
            // Load current account and account-specific data on page load
            loadCurrentAccount();
          </script>
        </body>
        </html>
      `);
    });
  }

  async syncIndividualData(integrationId, dataType) {
    try {
      const db = await getDatabase();
      
      // Get integration details
      const integration = await db.get('SELECT * FROM integrations WHERE id = ?', [integrationId]);
      if (!integration) {
        return { success: false, error: 'Integration not found' };
      }

      // Get the real cloud ID from Jira API
      const { JiraApiService } = await import('./jira-api.js');
      const apiService = new JiraApiService(integration.access_token);
      const resources = await apiService.getAccessibleResources();
      
      if (resources.length === 0) {
        return { success: false, error: 'No accessible Jira resources found' };
      }
      
      // Use the first accessible resource
      const cloudId = resources[0].id;
      console.log(`🔍 Using cloud ID: ${cloudId}`);
      
      const { ComprehensiveJiraSync } = await import('./comprehensive-sync.js');
      const syncService = new ComprehensiveJiraSync(integration.access_token, cloudId);
      
      let result = { success: true, message: '', count: 0 };
      
      switch (dataType) {
        case 'projects':
          await syncService.syncProjects(integrationId);
          result.message = 'Projects synced successfully';
          break;
        case 'issue-types':
          await syncService.syncIssueTypes(integrationId);
          result.message = 'Issue types synced successfully';
          break;
        case 'priorities':
          await syncService.syncPriorities(integrationId);
          result.message = 'Priorities synced successfully';
          break;
        case 'statuses':
          await syncService.syncStatuses(integrationId);
          result.message = 'Statuses synced successfully';
          break;
        case 'resolutions':
          await syncService.syncResolutions(integrationId);
          result.message = 'Resolutions synced successfully';
          break;
        case 'users':
          await syncService.syncUsers(integrationId);
          result.message = 'Users synced successfully';
          break;
        case 'groups':
          await syncService.syncGroups(integrationId);
          result.message = 'Groups synced successfully';
          break;
        case 'fields':
          await syncService.syncFields(integrationId);
          result.message = 'Fields synced successfully';
          break;
        case 'labels':
          await syncService.syncLabels(integrationId);
          result.message = 'Labels synced successfully';
          break;
        case 'components':
          await syncService.syncComponents(integrationId);
          result.message = 'Components synced successfully';
          break;
        case 'versions':
          await syncService.syncVersions(integrationId);
          result.message = 'Versions synced successfully';
          break;
        case 'workflows':
          await syncService.syncWorkflows(integrationId);
          result.message = 'Workflows synced successfully';
          break;
        case 'dashboards':
          await syncService.syncDashboards(integrationId);
          result.message = 'Dashboards synced successfully';
          break;
        case 'filters':
          await syncService.syncFilters(integrationId);
          result.message = 'Filters synced successfully';
          break;
        case 'permissions':
          await syncService.syncPermissions(integrationId);
          result.message = 'Permissions synced successfully';
          break;
        case 'issues':
          await syncService.syncIssuesComprehensive(integrationId);
          result.message = 'Issues synced successfully';
          break;
        case 'comments':
          await syncService.syncIssueComments(integrationId);
          result.message = 'Comments synced successfully';
          break;
        case 'worklogs':
          await syncService.syncIssueWorklogs(integrationId);
          result.message = 'Worklogs synced successfully';
          break;
        case 'attachments':
          await syncService.syncIssueAttachments(integrationId);
          result.message = 'Attachments synced successfully';
          break;
        case 'issue-links':
          await syncService.syncIssueLinks(integrationId);
          result.message = 'Issue links synced successfully';
          break;
        default:
          return { success: false, error: 'Unknown data type' };
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Individual sync error for ${dataType}:`, error);
      return { success: false, error: error.message };
    }
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🌐 Web server started on http://localhost:${this.port}`);
      console.log(`📊 Dashboard: http://localhost:${this.port}/dashboard`);
      console.log(`🔗 Health check: http://localhost:${this.port}/health`);
    });
  }
}

