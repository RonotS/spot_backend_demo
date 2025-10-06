import { getDatabase } from './database.js';

export class ComprehensiveJiraSync {
  constructor(accessToken, cloudId) {
    this.accessToken = accessToken;
    this.cloudId = cloudId;
    this.baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
  }

  /**
   * Make authenticated request to Jira API
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Sync all Jira data comprehensively
   */
  async syncAllData(integrationId) {
    console.log('🚀 Starting comprehensive Jira data sync...');
    
    try {
      // 1. Sync Projects
      await this.syncProjects(integrationId);
      
      // 2. Sync Issue Types
      await this.syncIssueTypes(integrationId);
      
      // 3. Sync Priorities
      await this.syncPriorities(integrationId);
      
      // 4. Sync Statuses
      await this.syncStatuses(integrationId);
      
      // 5. Sync Resolutions
      await this.syncResolutions(integrationId);
      
      // 6. Sync Users
      await this.syncUsers(integrationId);
      
      // 7. Sync Groups
      await this.syncGroups(integrationId);
      
      // 8. Sync Issue Fields
      await this.syncIssueFields(integrationId);
      
      // 9. Sync Labels
      await this.syncLabels(integrationId);
      
      // 10. Sync Components
      await this.syncComponents(integrationId);
      
      // 11. Sync Versions
      await this.syncVersions(integrationId);
      
      // 12. Sync Workflows
      await this.syncWorkflows(integrationId);
      
      // 13. Sync Dashboards
      await this.syncDashboards(integrationId);
      
      // 14. Sync Filters
      await this.syncFilters(integrationId);
      
      // 15. Sync Permissions
      await this.syncPermissions(integrationId);
      
      // 16. Sync Issues with all details
      await this.syncIssuesComprehensive(integrationId);
      
      // 17. Sync Issue Comments
      await this.syncIssueComments(integrationId);
      
      // 18. Sync Issue Worklogs
      await this.syncIssueWorklogs(integrationId);
      
      // 19. Sync Issue Attachments
      await this.syncIssueAttachments(integrationId);
      
      // 20. Sync Issue Links
      await this.syncIssueLinks(integrationId);
      
      console.log('✅ Comprehensive Jira data sync completed successfully!');
      
    } catch (error) {
      console.error('❌ Comprehensive sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync Projects
   */
  async syncProjects(integrationId) {
    console.log('📁 Syncing projects...');
    const projects = await this.makeRequest('/project');
    const db = await getDatabase();
    
    for (const project of projects) {
      await db.run(`
        INSERT OR REPLACE INTO jira_projects 
        (integration_id, project_key, project_name, project_id, project_type, 
         description, lead_account_id, lead_display_name, url, avatar_urls, 
         project_category, is_private, raw_data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        integrationId,
        project.key,
        project.name,
        project.id,
        project.projectTypeKey,
        project.description || null,
        project.lead?.accountId || null,
        project.lead?.displayName || null,
        project.self,
        JSON.stringify(project.avatarUrls || {}),
        JSON.stringify(project.projectCategory || {}),
        project.isPrivate || false,
        JSON.stringify(project),
        new Date().toISOString()
      ]);
    }
    console.log(`✅ Synced ${projects.length} projects`);
  }

  /**
   * Sync Issue Types
   */
  async syncIssueTypes(integrationId) {
    console.log('🎫 Syncing issue types...');
    const issueTypes = await this.makeRequest('/issuetype');
    const db = await getDatabase();
    
    for (const issueType of issueTypes) {
      await db.run(`
        INSERT OR REPLACE INTO jira_issue_types 
        (integration_id, issue_type_id, name, description, icon_url, 
         subtask, raw_data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        integrationId,
        issueType.id,
        issueType.name,
        issueType.description || null,
        issueType.iconUrl || null,
        issueType.subtask || false,
        JSON.stringify(issueType),
        new Date().toISOString()
      ]);
    }
    console.log(`✅ Synced ${issueTypes.length} issue types`);
  }

  /**
   * Sync Priorities
   */
  async syncPriorities(integrationId) {
    console.log('⚡ Syncing priorities...');
    const priorities = await this.makeRequest('/priority');
    const db = await getDatabase();
    
    for (const priority of priorities) {
      await db.run(`
        INSERT OR REPLACE INTO jira_priorities 
        (integration_id, priority_id, name, description, icon_url, 
         status_color, raw_data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        integrationId,
        priority.id,
        priority.name,
        priority.description || null,
        priority.iconUrl || null,
        priority.statusColor || null,
        JSON.stringify(priority),
        new Date().toISOString()
      ]);
    }
    console.log(`✅ Synced ${priorities.length} priorities`);
  }

  /**
   * Sync Statuses
   */
  async syncStatuses(integrationId) {
    console.log('📊 Syncing statuses...');
    const statuses = await this.makeRequest('/status');
    const db = await getDatabase();
    
    for (const status of statuses) {
      await db.run(`
        INSERT OR REPLACE INTO jira_statuses 
        (integration_id, status_id, name, description, icon_url, 
         status_category, raw_data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        integrationId,
        status.id,
        status.name,
        status.description || null,
        status.iconUrl || null,
        JSON.stringify(status.statusCategory || {}),
        JSON.stringify(status),
        new Date().toISOString()
      ]);
    }
    console.log(`✅ Synced ${statuses.length} statuses`);
  }

  /**
   * Sync Resolutions
   */
  async syncResolutions(integrationId) {
    console.log('🔧 Syncing resolutions...');
    const resolutions = await this.makeRequest('/resolution');
    const db = await getDatabase();
    
    for (const resolution of resolutions) {
      await db.run(`
        INSERT OR REPLACE INTO jira_resolutions 
        (integration_id, resolution_id, name, description, raw_data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        integrationId,
        resolution.id,
        resolution.name,
        resolution.description || null,
        JSON.stringify(resolution),
        new Date().toISOString()
      ]);
    }
    console.log(`✅ Synced ${resolutions.length} resolutions`);
  }

  /**
   * Sync Users
   */
  async syncUsers(integrationId) {
    console.log('👥 Syncing users...');
    try {
      const users = await this.makeRequest('/users/search?maxResults=1000');
      const db = await getDatabase();
      
      for (const user of users) {
        await db.run(`
          INSERT OR REPLACE INTO jira_users 
          (integration_id, account_id, display_name, email_address, 
           active, time_zone, locale, avatar_urls, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          user.accountId,
          user.displayName,
          user.emailAddress || null,
          user.active || false,
          user.timeZone || null,
          user.locale || null,
          JSON.stringify(user.avatarUrls || {}),
          JSON.stringify(user),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${users.length} users`);
    } catch (error) {
      console.warn('⚠️ Could not sync users (may require admin permissions):', error.message);
    }
  }

  /**
   * Sync Groups
   */
  async syncGroups(integrationId) {
    console.log('👥 Syncing groups...');
    try {
      const groups = await this.makeRequest('/groups/picker?maxResults=1000');
      const db = await getDatabase();
      
      for (const group of groups.groups || []) {
        await db.run(`
          INSERT OR REPLACE INTO jira_groups 
          (integration_id, group_id, name, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `, [
          integrationId,
          group.groupId,
          group.name,
          JSON.stringify(group),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${groups.groups?.length || 0} groups`);
    } catch (error) {
      console.warn('⚠️ Could not sync groups (may require admin permissions):', error.message);
    }
  }

  /**
   * Sync Issue Fields
   */
  async syncIssueFields(integrationId) {
    console.log('📝 Syncing issue fields...');
    const fields = await this.makeRequest('/field');
    const db = await getDatabase();
    
    for (const field of fields) {
        await db.run(`
          INSERT OR REPLACE INTO jira_fields 
          (integration_id, field_id, name, field_type, description, 
           is_custom, is_system, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          field.id,
          field.name,
          field.schema?.type || 'unknown',
          field.description || null,
          field.custom || false,
          !field.custom || false,
          JSON.stringify(field),
          new Date().toISOString()
        ]);
    }
    console.log(`✅ Synced ${fields.length} issue fields`);
  }

  /**
   * Sync Labels
   */
  async syncLabels(integrationId) {
    console.log('🏷️ Syncing labels...');
    try {
      // Use a more specific JQL query to avoid unbounded queries
      const issues = await this.makeRequest('/search?jql=updated >= -30d ORDER BY updated DESC&maxResults=100');
      const db = await getDatabase();
      const labelSet = new Set();
      
      for (const issue of issues.issues || []) {
        if (issue.fields?.labels) {
          for (const label of issue.fields.labels) {
            labelSet.add(label);
          }
        }
      }
      
      for (const label of labelSet) {
        await db.run(`
          INSERT OR REPLACE INTO jira_labels 
          (integration_id, label_name, usage_count, updated_at)
          VALUES (?, ?, 1, ?)
        `, [
          integrationId,
          label,
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${labelSet.size} labels`);
    } catch (error) {
      console.warn('⚠️ Could not sync labels:', error.message);
    }
  }

  /**
   * Sync Components
   */
  async syncComponents(integrationId) {
    console.log('🧩 Syncing components...');
    const db = await getDatabase();
    const projects = await db.all('SELECT project_key FROM jira_projects WHERE integration_id = ?', [integrationId]);
    
    let totalComponents = 0;
    for (const project of projects) {
      try {
        const components = await this.makeRequest(`/project/${project.project_key}/components`);
        
        for (const component of components) {
          await db.run(`
            INSERT OR REPLACE INTO jira_components 
            (integration_id, component_id, name, description, project_key, 
             lead_account_id, assignee_type, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            component.id,
            component.name,
            component.description || null,
            project.project_key,
            component.lead?.accountId || null,
            component.assigneeType || null,
            JSON.stringify(component),
            new Date().toISOString()
          ]);
          totalComponents++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync components for project ${project.project_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalComponents} components`);
  }

  /**
   * Sync Versions
   */
  async syncVersions(integrationId) {
    console.log('📅 Syncing versions...');
    const db = await getDatabase();
    const projects = await db.all('SELECT project_key FROM jira_projects WHERE integration_id = ?', [integrationId]);
    
    let totalVersions = 0;
    for (const project of projects) {
      try {
        const versions = await this.makeRequest(`/project/${project.project_key}/versions`);
        
        for (const version of versions) {
          await db.run(`
            INSERT OR REPLACE INTO jira_versions 
            (integration_id, version_id, name, description, project_key, 
             archived, released, release_date, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            version.id,
            version.name,
            version.description || null,
            project.project_key,
            version.archived || false,
            version.released || false,
            version.releaseDate || null,
            JSON.stringify(version),
            new Date().toISOString()
          ]);
          totalVersions++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync versions for project ${project.project_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalVersions} versions`);
  }

  /**
   * Sync Workflows
   */
  async syncWorkflows(integrationId) {
    console.log('🔄 Syncing workflows...');
    try {
      const workflows = await this.makeRequest('/workflow');
      const db = await getDatabase();
      
      for (const workflow of workflows || []) {
        // Ensure workflow has an id
        const workflowId = workflow.id || `workflow_${Date.now()}_${Math.random()}`;
        
        await db.run(`
          INSERT OR REPLACE INTO jira_workflows 
          (integration_id, workflow_id, name, description, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          workflowId,
          workflow.name || 'Unknown Workflow',
          workflow.description || null,
          JSON.stringify(workflow),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${(workflows || []).length} workflows`);
    } catch (error) {
      console.warn('⚠️ Could not sync workflows (may require admin permissions):', error.message);
    }
  }

  /**
   * Sync Dashboards
   */
  async syncDashboards(integrationId) {
    console.log('📊 Syncing dashboards...');
    try {
      const dashboards = await this.makeRequest('/dashboard');
      const db = await getDatabase();
      
      for (const dashboard of dashboards.dashboards || []) {
        await db.run(`
          INSERT OR REPLACE INTO jira_dashboards 
          (integration_id, dashboard_id, name, description, owner_account_id, 
           share_permissions, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          dashboard.id,
          dashboard.name,
          dashboard.description || null,
          dashboard.owner?.accountId || null,
          JSON.stringify(dashboard.sharePermissions || []),
          JSON.stringify(dashboard),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${dashboards.dashboards?.length || 0} dashboards`);
    } catch (error) {
      console.warn('⚠️ Could not sync dashboards:', error.message);
    }
  }

  /**
   * Sync Filters
   */
  async syncFilters(integrationId) {
    console.log('🔍 Syncing filters...');
    try {
      const filters = await this.makeRequest('/filter/search?maxResults=1000');
      const db = await getDatabase();
      
      // Handle different response formats
      const filterList = Array.isArray(filters) ? filters : (filters.filters || []);
      
      for (const filter of filterList) {
        await db.run(`
          INSERT OR REPLACE INTO jira_filters 
          (integration_id, filter_id, name, description, jql, owner_account_id, 
           view_url, search_url, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          filter.id,
          filter.name,
          filter.description || null,
          filter.jql || null,
          filter.owner?.accountId || null,
          filter.viewUrl || null,
          filter.searchUrl || null,
          JSON.stringify(filter),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${filterList.length} filters`);
    } catch (error) {
      console.warn('⚠️ Could not sync filters:', error.message);
    }
  }

  /**
   * Sync Permissions
   */
  async syncPermissions(integrationId) {
    console.log('🔐 Syncing permissions...');
    try {
      const permissions = await this.makeRequest('/permissions');
      const db = await getDatabase();
      
      // Handle different response formats safely
      const permissionList = Array.isArray(permissions) ? permissions : 
                            (permissions.permissions || []);
      
      for (const permission of permissionList) {
        await db.run(`
          INSERT OR REPLACE INTO jira_permissions 
          (integration_id, permission_id, name, type, description, 
           have_permission, raw_data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          integrationId,
          permission.id,
          permission.name,
          permission.type || null,
          permission.description || null,
          permission.havePermission || false,
          JSON.stringify(permission),
          new Date().toISOString()
        ]);
      }
      console.log(`✅ Synced ${permissionList.length} permissions`);
    } catch (error) {
      console.warn('⚠️ Could not sync permissions:', error.message);
    }
  }

  /**
   * Sync Issues with comprehensive details
   */
  async syncIssuesComprehensive(integrationId) {
    console.log('📋 Syncing issues comprehensively...');
    const db = await getDatabase();
    const projects = await db.all('SELECT project_key FROM jira_projects WHERE integration_id = ?', [integrationId]);
    
    let totalIssues = 0;
    for (const project of projects) {
      try {
        const issues = await this.makeRequest(`/search/jql?jql=project = "${project.project_key}" ORDER BY updated DESC&maxResults=1000&expand=changelog,comments,worklog,attachments,issuelinks`);
        
        for (const issue of issues.issues || []) {
          const fields = issue.fields;
          
          // Extract comprehensive issue data with null safety
          const assignee = fields.assignee || null;
          const reporter = fields.reporter || null;
          const epicLink = fields.customfield_10014; // Epic Link
          const storyPoints = fields.customfield_10016; // Story Points
          const status = fields.status;
          const priority = fields.priority;
          const issueType = fields.issuetype;
          const resolution = fields.resolution;
          const labels = fields.labels || [];
          const components = fields.components || [];
          const fixVersions = fields.fixVersions || [];
          const versions = fields.versions || [];
          const parent = fields.parent;
          const subtasks = fields.subtasks || [];
          const issuelinks = fields.issuelinks || [];
          const worklog = fields.worklog;
          const comments = fields.comment;
          const attachments = fields.attachment || [];
          
          await db.run(`
            INSERT OR REPLACE INTO jira_issues 
            (integration_id, project_id, issue_key, issue_id, summary, 
             description, assignee_account_id, assignee_display_name, assignee_email,
             reporter_account_id, reporter_display_name, reporter_email,
             epic_key, epic_name, story_points, status_name, status_id,
             priority_name, priority_id, issue_type_name, issue_type_id,
             resolution_name, resolution_id, labels, components, fix_versions,
             versions, parent_key, subtasks, issuelinks, worklog, comments,
             attachments, created, updated, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            project.project_key,
            issue.key,
            issue.id,
            fields.summary,
            JSON.stringify(fields.description || {}),
            assignee?.accountId || null,
            assignee?.displayName || null,
            assignee?.emailAddress || null,
            reporter?.accountId || null,
            reporter?.displayName || null,
            reporter?.emailAddress || null,
            epicLink || null,
            null, // Epic name would need additional API call
            storyPoints || null,
            status?.name || null,
            status?.id || null,
            priority?.name || null,
            priority?.id || null,
            issueType?.name || null,
            issueType?.id || null,
            resolution?.name || null,
            resolution?.id || null,
            JSON.stringify(labels),
            JSON.stringify(components),
            JSON.stringify(fixVersions),
            JSON.stringify(versions),
            parent?.key || null,
            JSON.stringify(subtasks),
            JSON.stringify(issuelinks),
            JSON.stringify(worklog || {}),
            JSON.stringify(comments || {}),
            JSON.stringify(attachments),
            fields.created || null,
            fields.updated || null,
            JSON.stringify(issue),
            new Date().toISOString()
          ]);
          totalIssues++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync issues for project ${project.project_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalIssues} issues comprehensively`);
  }

  /**
   * Sync Issue Comments
   */
  async syncIssueComments(integrationId) {
    console.log('💬 Syncing issue comments...');
    const db = await getDatabase();
    const issues = await db.all('SELECT issue_key FROM jira_issues WHERE integration_id = ?', [integrationId]);
    
    let totalComments = 0;
    for (const issue of issues) {
      try {
        const comments = await this.makeRequest(`/issue/${issue.issue_key}/comment`);
        
        for (const comment of comments.comments || []) {
          await db.run(`
            INSERT OR REPLACE INTO jira_comments 
            (integration_id, comment_id, issue_key, author_account_id, 
             author_display_name, body, created, updated, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            comment.id,
            issue.issue_key,
            comment.author?.accountId || null,
            comment.author?.displayName || null,
            JSON.stringify(comment.body || {}),
            comment.created || null,
            comment.updated || null,
            JSON.stringify(comment),
            new Date().toISOString()
          ]);
          totalComments++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync comments for issue ${issue.issue_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalComments} comments`);
  }

  /**
   * Sync Issue Worklogs
   */
  async syncIssueWorklogs(integrationId) {
    console.log('⏱️ Syncing issue worklogs...');
    const db = await getDatabase();
    const issues = await db.all('SELECT issue_key FROM jira_issues WHERE integration_id = ?', [integrationId]);
    
    let totalWorklogs = 0;
    for (const issue of issues) {
      try {
        const worklogs = await this.makeRequest(`/issue/${issue.issue_key}/worklog`);
        
        for (const worklog of worklogs.worklogs || []) {
          await db.run(`
            INSERT OR REPLACE INTO jira_worklogs 
            (integration_id, worklog_id, issue_key, author_account_id, 
             author_display_name, comment, time_spent, time_spent_seconds,
             started, created, updated, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            worklog.id,
            issue.issue_key,
            worklog.author?.accountId || null,
            worklog.author?.displayName || null,
            JSON.stringify(worklog.comment || {}),
            worklog.timeSpent || null,
            worklog.timeSpentSeconds || null,
            worklog.started || null,
            worklog.created || null,
            worklog.updated || null,
            JSON.stringify(worklog),
            new Date().toISOString()
          ]);
          totalWorklogs++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync worklogs for issue ${issue.issue_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalWorklogs} worklogs`);
  }

  /**
   * Sync Issue Attachments
   */
  async syncIssueAttachments(integrationId) {
    console.log('📎 Syncing issue attachments...');
    const db = await getDatabase();
    const issues = await db.all('SELECT issue_key FROM jira_issues WHERE integration_id = ?', [integrationId]);
    
    let totalAttachments = 0;
    for (const issue of issues) {
      try {
        const attachments = await this.makeRequest(`/issue/${issue.issue_key}?fields=attachment`);
        
        for (const attachment of attachments.fields?.attachment || []) {
          await db.run(`
            INSERT OR REPLACE INTO jira_attachments 
            (integration_id, attachment_id, issue_key, filename, 
             author_account_id, author_display_name, created, size, 
             mime_type, content_url, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            attachment.id,
            issue.issue_key,
            attachment.filename,
            attachment.author?.accountId || null,
            attachment.author?.displayName || null,
            attachment.created || null,
            attachment.size || null,
            attachment.mimeType || null,
            attachment.content || null,
            JSON.stringify(attachment),
            new Date().toISOString()
          ]);
          totalAttachments++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync attachments for issue ${issue.issue_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalAttachments} attachments`);
  }

  /**
   * Sync Issue Links
   */
  async syncIssueLinks(integrationId) {
    console.log('🔗 Syncing issue links...');
    const db = await getDatabase();
    const issues = await db.all('SELECT issue_key FROM jira_issues WHERE integration_id = ?', [integrationId]);
    
    let totalLinks = 0;
    for (const issue of issues) {
      try {
        const links = await this.makeRequest(`/issue/${issue.issue_key}?fields=issuelinks`);
        
        for (const link of links.fields?.issuelinks || []) {
          await db.run(`
            INSERT OR REPLACE INTO jira_issue_links 
            (integration_id, link_id, issue_key, outward_issue_key, 
             inward_issue_key, link_type_id, link_type_name, raw_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            integrationId,
            link.id,
            issue.issue_key,
            link.outwardIssue?.key || null,
            link.inwardIssue?.key || null,
            link.type?.id || null,
            link.type?.name || null,
            JSON.stringify(link),
            new Date().toISOString()
          ]);
          totalLinks++;
        }
      } catch (error) {
        console.warn(`⚠️ Could not sync links for issue ${issue.issue_key}:`, error.message);
      }
    }
    console.log(`✅ Synced ${totalLinks} issue links`);
  }
}
