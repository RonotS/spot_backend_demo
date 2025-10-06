import { getDatabase } from './database.js';

async function checkDatabase() {
  try {
    const db = await getDatabase();
    
    console.log('🔍 Checking database...');
    
    // Check integrations
    const integrations = await db.all('SELECT * FROM integrations');
    console.log('📊 Integrations:', integrations.length);
    integrations.forEach(integration => {
      console.log(`  - ID: ${integration.id}, Project: ${integration.project_id}, Active: ${integration.is_active}`);
    });
    
    // Check projects
    const projects = await db.all('SELECT * FROM jira_projects');
    console.log('📊 Projects:', projects.length);
    projects.forEach(project => {
      console.log(`  - ID: ${project.id}, Key: ${project.project_key}, Name: ${project.project_name}`);
    });
    
    // Check issues
    const issues = await db.all('SELECT * FROM jira_issues');
    console.log('📊 Issues:', issues.length);
    issues.forEach(issue => {
      console.log(`  - ID: ${issue.id}, Key: ${issue.issue_key}, Assignee: ${issue.assignee_display_name || 'Unassigned'}`);
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();





