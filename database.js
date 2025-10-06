import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

export async function initDatabase() {
  if (db) return db;
  
  db = await open({
    filename: './jira_auth.db',
    driver: sqlite3.Database
  });

  // Create comprehensive Jira data tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT,
      account_email TEXT,
      jira_domain TEXT,
      project_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      last_refresh_at TEXT,
      refresh_failures INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      is_primary BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jira_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      project_key TEXT,
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
      is_active BOOLEAN DEFAULT 1,
      cloud_id TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_issue_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      issue_type_id TEXT,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      subtask BOOLEAN,
      hierarchy_level INTEGER,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      priority_id TEXT,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      status_color TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      status_id TEXT,
      name TEXT,
      description TEXT,
      icon_url TEXT,
      status_category TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      resolution_id TEXT,
      name TEXT,
      description TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      account_id TEXT,
      display_name TEXT,
      email_address TEXT,
      active BOOLEAN,
      time_zone TEXT,
      locale TEXT,
      avatar_urls TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      group_id TEXT,
      name TEXT,
      html TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      field_id TEXT,
      name TEXT,
      field_type TEXT,
      description TEXT,
      is_custom BOOLEAN,
      is_system BOOLEAN,
      custom BOOLEAN,
      orderable BOOLEAN,
      navigable BOOLEAN,
      searchable BOOLEAN,
      schema TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      label_name TEXT,
      usage_count INTEGER,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      component_id TEXT,
      name TEXT,
      description TEXT,
      project_key TEXT,
      lead_account_id TEXT,
      assignee_type TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      version_id TEXT,
      name TEXT,
      description TEXT,
      project_key TEXT,
      archived BOOLEAN,
      released BOOLEAN,
      start_date TEXT,
      release_date TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      workflow_id TEXT,
      name TEXT,
      description TEXT,
      transitions TEXT,
      statuses TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      dashboard_id TEXT,
      name TEXT,
      description TEXT,
      owner_account_id TEXT,
      view TEXT,
      share_permissions TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      filter_id TEXT,
      name TEXT,
      description TEXT,
      jql TEXT,
      owner_account_id TEXT,
      view_url TEXT,
      search_url TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      permission_id TEXT,
      name TEXT,
      type TEXT,
      description TEXT,
      have_permission BOOLEAN,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      project_id TEXT,
      issue_key TEXT,
      issue_id TEXT,
      summary TEXT,
      description TEXT,
      assignee_account_id TEXT,
      assignee_display_name TEXT,
      assignee_email TEXT,
      reporter_account_id TEXT,
      reporter_display_name TEXT,
      reporter_email TEXT,
      epic_key TEXT,
      epic_name TEXT,
      story_points REAL,
      status_name TEXT,
      status_id TEXT,
      priority_name TEXT,
      priority_id TEXT,
      issue_type_name TEXT,
      issue_type_id TEXT,
      resolution_name TEXT,
      resolution_id TEXT,
      labels TEXT,
      components TEXT,
      fix_versions TEXT,
      versions TEXT,
      parent_key TEXT,
      subtasks TEXT,
      issuelinks TEXT,
      worklog TEXT,
      comments TEXT,
      attachments TEXT,
      created TEXT,
      updated TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      comment_id TEXT,
      issue_key TEXT,
      author_account_id TEXT,
      author_display_name TEXT,
      body TEXT,
      created TEXT,
      updated TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_worklogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      worklog_id TEXT,
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
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      attachment_id TEXT,
      issue_key TEXT,
      filename TEXT,
      author_account_id TEXT,
      author_display_name TEXT,
      created TEXT,
      size INTEGER,
      mime_type TEXT,
      content_url TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );

    CREATE TABLE IF NOT EXISTS jira_issue_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER,
      link_id TEXT,
      issue_key TEXT,
      outward_issue_key TEXT,
      inward_issue_key TEXT,
      link_type_id TEXT,
      link_type_name TEXT,
      raw_data TEXT,
      updated_at TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations (id)
    );
  `);

  console.log('✅ Database initialized successfully');
  return db;
}

export async function getDatabase() {
  if (!db) {
    await initDatabase();
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}