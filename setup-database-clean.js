import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function setupCleanDatabase() {
  const db = await open({
    filename: './jira_auth.db',
    driver: sqlite3.Database
  });

  console.log('🗑️ Dropping existing tables...');
  
  // Drop all existing tables
  const tables = [
    'jira_issue_links', 'jira_attachments', 'jira_worklogs', 'jira_comments', 
    'jira_issues', 'jira_permissions', 'jira_filters', 'jira_dashboards', 
    'jira_workflows', 'jira_versions', 'jira_components', 'jira_labels', 
    'jira_fields', 'jira_groups', 'jira_users', 'jira_resolutions', 
    'jira_statuses', 'jira_priorities', 'jira_issue_types', 'jira_projects', 
    'integrations'
  ];
  
  for (const table of tables) {
    try {
      await db.run(`DROP TABLE IF EXISTS ${table}`);
    } catch (error) {
      console.log(`⚠️ Could not drop ${table}:`, error.message);
    }
  }

  console.log('🏗️ Creating clean database schema with unique constraints...');

  // Create integrations table
  await db.run(`
    CREATE TABLE integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      last_refresh_at TEXT,
      refresh_failures INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Jira Projects table with unique constraint
  await db.run(`
    CREATE TABLE jira_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      project_key TEXT NOT NULL,
      project_name TEXT,
      project_id TEXT,
      project_type TEXT,
      description TEXT,
      lead_account_id TEXT,
      lead_display_name TEXT,
      url TEXT,
      avatar_urls TEXT,
      project_category TEXT,
      is_private BOOLEAN,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, project_key)
    )
  `);

  // Create Jira Issue Types table with unique constraint
  await db.run(`
    CREATE TABLE jira_issue_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      issue_type_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      subtask BOOLEAN,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, issue_type_id)
    )
  `);

  // Create Jira Priorities table with unique constraint
  await db.run(`
    CREATE TABLE jira_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      priority_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      status_color TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, priority_id)
    )
  `);

  // Create Jira Statuses table with unique constraint
  await db.run(`
    CREATE TABLE jira_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      status_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      status_category TEXT,
      status_category_key TEXT,
      status_category_color_name TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, status_id)
    )
  `);

  // Create Jira Resolutions table with unique constraint
  await db.run(`
    CREATE TABLE jira_resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      resolution_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, resolution_id)
    )
  `);

  // Create Jira Users table with unique constraint
  await db.run(`
    CREATE TABLE jira_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      account_id TEXT NOT NULL,
      display_name TEXT,
      email_address TEXT,
      active INTEGER DEFAULT 1,
      time_zone TEXT,
      locale TEXT,
      avatar_urls TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, account_id)
    )
  `);

  // Create Jira Groups table with unique constraint
  await db.run(`
    CREATE TABLE jira_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, group_id)
    )
  `);

  // Create Jira Fields table with unique constraint
  await db.run(`
    CREATE TABLE jira_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      field_id TEXT NOT NULL,
      name TEXT,
      field_type TEXT,
      description TEXT,
      is_custom BOOLEAN,
      is_system BOOLEAN,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, field_id)
    )
  `);

  // Create Jira Labels table with unique constraint
  await db.run(`
    CREATE TABLE jira_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      label_name TEXT NOT NULL,
      usage_count INTEGER DEFAULT 1,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, label_name)
    )
  `);

  // Create Jira Components table with unique constraint
  await db.run(`
    CREATE TABLE jira_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      component_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      project_key TEXT,
      lead_account_id TEXT,
      assignee_type TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, component_id)
    )
  `);

  // Create Jira Versions table with unique constraint
  await db.run(`
    CREATE TABLE jira_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      version_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      project_key TEXT,
      archived BOOLEAN,
      released BOOLEAN,
      release_date TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, version_id)
    )
  `);

  // Create Jira Workflows table with unique constraint
  await db.run(`
    CREATE TABLE jira_workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      workflow_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      is_system_workflow BOOLEAN,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, workflow_id)
    )
  `);

  // Create Jira Dashboards table with unique constraint
  await db.run(`
    CREATE TABLE jira_dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      dashboard_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      owner_account_id TEXT,
      share_permissions TEXT,
      edit_permissions TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, dashboard_id)
    )
  `);

  // Create Jira Filters table with unique constraint
  await db.run(`
    CREATE TABLE jira_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      filter_id TEXT NOT NULL,
      name TEXT,
      description TEXT,
      jql TEXT,
      owner_account_id TEXT,
      view_url TEXT,
      search_url TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, filter_id)
    )
  `);

  // Create Jira Permissions table with unique constraint
  await db.run(`
    CREATE TABLE jira_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      permission_id TEXT NOT NULL,
      name TEXT,
      type TEXT,
      description TEXT,
      have_permission BOOLEAN,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, permission_id)
    )
  `);

  // Create Jira Issues table with unique constraint
  await db.run(`
    CREATE TABLE jira_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      issue_key TEXT NOT NULL,
      issue_id TEXT,
      summary TEXT,
      description TEXT,
      issue_type TEXT,
      status TEXT,
      priority TEXT,
      assignee_account_id TEXT,
      assignee_display_name TEXT,
      reporter_account_id TEXT,
      reporter_display_name TEXT,
      created TEXT,
      updated TEXT,
      project_key TEXT,
      labels TEXT,
      components TEXT,
      fix_versions TEXT,
      affected_versions TEXT,
      story_points REAL,
      epic_key TEXT,
      epic_name TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, issue_key)
    )
  `);

  // Create Jira Comments table with unique constraint
  await db.run(`
    CREATE TABLE jira_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      comment_id TEXT NOT NULL,
      issue_key TEXT,
      author_account_id TEXT,
      author_display_name TEXT,
      body TEXT,
      created TEXT,
      updated TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, comment_id)
    )
  `);

  // Create Jira Worklogs table with unique constraint
  await db.run(`
    CREATE TABLE jira_worklogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      worklog_id TEXT NOT NULL,
      issue_key TEXT,
      author_account_id TEXT,
      author_display_name TEXT,
      comment TEXT,
      time_spent TEXT,
      time_spent_seconds INTEGER,
      started TEXT,
      created TEXT,
      updated TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, worklog_id)
    )
  `);

  // Create Jira Attachments table with unique constraint
  await db.run(`
    CREATE TABLE jira_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      attachment_id TEXT NOT NULL,
      issue_key TEXT,
      filename TEXT,
      mime_type TEXT,
      size INTEGER,
      author_account_id TEXT,
      author_display_name TEXT,
      created TEXT,
      content_url TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, attachment_id)
    )
  `);

  // Create Jira Issue Links table with unique constraint
  await db.run(`
    CREATE TABLE jira_issue_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      link_id TEXT NOT NULL,
      issue_key TEXT,
      linked_issue_key TEXT,
      link_type TEXT,
      inward_issue_key TEXT,
      outward_issue_key TEXT,
      raw_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id),
      UNIQUE(integration_id, link_id)
    )
  `);

  console.log('✅ Clean database schema created with unique constraints');
  
  await db.close();
}

setupCleanDatabase().catch(console.error);




