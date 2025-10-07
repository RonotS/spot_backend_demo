import { getDatabase } from './database.js';

export class JiraApiService {
  constructor(accessToken, baseUrl) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
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
   * Get accessible Jira sites
   */
  async getAccessibleResources() {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch accessible resources: ${response.status} ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get Jira projects
   */
  async getProjects(cloudId) {
    // For Atlassian Cloud, we need to use the cloud-specific base URL
    const cloudBaseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
    const url = `${cloudBaseUrl}/rest/api/3/project`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get Jira issues for a project
   */
  async getIssues(cloudId, projectKey, startAt = 0, maxResults = 50) {
    const jql = `project = "${projectKey}" ORDER BY updated DESC`;
    const cloudBaseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
    const url = `${cloudBaseUrl}/rest/api/3/search/jql`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: maxResults,
        fields: [
          'summary',
          'status',
          'assignee',
          'issuetype',
          'customfield_10014', // Epic Link
          'customfield_10016', // Story Points
          'labels',
          'components',
          'parent',
          'subtasks'
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get issue details
   */
  async getIssueDetails(cloudId, issueKey) {
    const cloudBaseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
    const url = `${cloudBaseUrl}/rest/api/3/issue/${issueKey}?expand=changelog`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Sync issues to database
   */
  async syncIssuesToDatabase(integrationId, projectId, cloudId, projectKey) {
    console.log(`🔄 Syncing issues for project ${projectKey}...`);
    
    const db = await getDatabase();
    let startAt = 0;
    const maxResults = 100;
    let totalIssues = 0;

    while (true) {
      const issuesData = await this.getIssues(cloudId, projectKey, startAt, maxResults);
      const issues = issuesData.issues || [];

      if (issues.length === 0) break;

      for (const issue of issues) {
        const fields = issue.fields;
        
        // Extract assignee information
        const assignee = fields.assignee;
        const assigneeName = assignee ? assignee.displayName : null;
        const assigneeEmail = assignee ? assignee.emailAddress : null;

        // Extract epic information
        const epicLink = fields.customfield_10014;
        const epicKey = epicLink || null;
        const epicName = null; // Would need additional API call to get epic name

        // Extract story points
        const storyPoints = fields.customfield_10016 || null;

        // Extract status
        const status = fields.status ? fields.status.name : null;

        // Extract issue type
        const issueType = fields.issuetype ? fields.issuetype.name : null;

        // Insert or update issue
        await db.run(`
          INSERT INTO jira_issues 
          (integration_id, project_id, issue_key, issue_id, summary, 
           assignee_account_id, assignee_display_name, assignee_email,
           epic_key, epic_name, story_points, status_name, issue_type_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(integration_id, issue_key) DO UPDATE SET
            project_id = excluded.project_id,
            issue_id = excluded.issue_id,
            summary = excluded.summary,
            assignee_account_id = excluded.assignee_account_id,
            assignee_display_name = excluded.assignee_display_name,
            assignee_email = excluded.assignee_email,
            epic_key = excluded.epic_key,
            epic_name = excluded.epic_name,
            story_points = excluded.story_points,
            status_name = excluded.status_name,
            issue_type_name = excluded.issue_type_name,
            updated_at = excluded.updated_at
        `, [
          integrationId,
          projectId,
          issue.key,
          issue.id,
          fields.summary,
          assignee?.accountId || null,
          assigneeName,
          assigneeEmail,
          epicKey,
          epicName,
          storyPoints,
          status,
          issueType,
          new Date().toISOString()
        ]);
      }

      totalIssues += issues.length;
      startAt += maxResults;

      // Break if we've reached the end
      if (issues.length < maxResults) break;
    }

    console.log(`✅ Synced ${totalIssues} issues for project ${projectKey}`);
    return totalIssues;
  }
}

