import { getDatabase } from './database.js';

async function deleteIntegration(integrationId) {
  console.log(`🗑️  Deleting Integration ${integrationId}`);
  console.log('================================\n');

  try {
    const db = await getDatabase();

    // 1. Show current integration info
    const integration = await db.get(
      'SELECT * FROM integrations WHERE id = ?',
      [integrationId]
    );

    if (!integration) {
      console.log(`❌ Integration ${integrationId} not found`);
      return;
    }

    console.log('📊 Integration Details:');
    console.log(`  - ID: ${integration.id}`);
    console.log(`  - Project: ${integration.project_id}`);
    console.log(`  - Created: ${integration.created_at}`);
    console.log(`  - Last refresh: ${integration.last_refresh_at}`);
    console.log(`  - Expires: ${integration.expires_at}`);
    console.log(`  - Active: ${integration.is_active ? 'YES' : 'NO'}`);
    console.log(`  - Refresh failures: ${integration.refresh_failures || 0}`);
    console.log('');

    // 2. Show related data
    const projects = await db.all(
      'SELECT COUNT(*) as count FROM jira_projects WHERE integration_id = ?',
      [integrationId]
    );
    
    const issues = await db.all(
      'SELECT COUNT(*) as count FROM jira_issues WHERE integration_id = ?',
      [integrationId]
    );

    console.log('📊 Related Data:');
    console.log(`  - Projects: ${projects[0].count}`);
    console.log(`  - Issues: ${issues[0].count}`);
    console.log('');

    // 3. Delete the integration and all related data
    console.log('🗑️  Deleting integration and all related data...');
    
    // Delete in order to respect foreign key constraints
    await db.run('DELETE FROM jira_issue_links WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_attachments WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_worklogs WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_comments WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_issues WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_projects WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_permissions WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_filters WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_dashboards WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_workflows WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_versions WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_components WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_labels WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_fields WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_groups WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_users WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_resolutions WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_statuses WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_priorities WHERE integration_id = ?', [integrationId]);
    await db.run('DELETE FROM jira_issue_types WHERE integration_id = ?', [integrationId]);
    
    // Finally delete the integration itself
    await db.run('DELETE FROM integrations WHERE id = ?', [integrationId]);

    console.log('✅ Integration and all related data deleted successfully');
    console.log('');

    // 4. Show remaining integrations
    console.log('📊 Remaining Active Integrations:');
    const remainingIntegrations = await db.all(
      'SELECT id, project_id, expires_at, is_active FROM integrations WHERE is_active = 1'
    );

    if (remainingIntegrations.length === 0) {
      console.log('❌ No active integrations remaining');
    } else {
      for (const integration of remainingIntegrations) {
        const expiresAt = new Date(integration.expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt - now;
        const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
        
        console.log(`  - ID: ${integration.id}, Project: ${integration.project_id}, Expires in: ${hoursUntilExpiry}h`);
      }
    }

  } catch (error) {
    console.error('❌ Delete failed:', error);
  }
}

// Get integration ID from command line argument
const integrationId = process.argv[2];

if (!integrationId) {
  console.log('Usage: node delete-integration.js <integration_id>');
  console.log('Example: node delete-integration.js 1');
  process.exit(1);
}

deleteIntegration(parseInt(integrationId));

