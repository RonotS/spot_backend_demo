import puppeteer from 'puppeteer';
import { getDatabase } from './database.js';

export class JiraAuthService {
  constructor() {
    this.clientId = process.env.JIRA_CLIENT_ID;
    this.clientSecret = process.env.JIRA_CLIENT_SECRET;
    this.redirectUri = process.env.JIRA_REDIRECT_URI;
    this.baseUrl = process.env.JIRA_BASE_URL;
    
    console.log('🔍 AuthService Constructor Debug:');
    console.log('  - Client ID:', this.clientId ? 'Set' : 'Missing');
    console.log('  - Client Secret:', this.clientSecret ? 'Set' : 'Missing');
    console.log('  - Redirect URI:', this.redirectUri);
    console.log('  - Base URL:', this.baseUrl);
  }

  /**
   * Generate OAuth URL for Jira authentication
   */
  generateOAuthUrl(state) {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: [
        'manage:jira-data-provider',
        'manage:jira-webhook',
        'write:jira-work',
        'read:jira-user',
        'manage:jira-configuration',
        'manage:jira-project',
        'read:jira-work',
        'offline_access'
      ].join(' '),
      redirect_uri: this.redirectUri,
      state: state,
      response_type: 'code',
      prompt: 'consent'
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Automate OAuth flow using Puppeteer
   */
  async automateOAuthFlow(projectId = 'demo-project') {
    console.log('🚀 Starting automated Jira OAuth flow...');
    
    const state = `auto-auth-${Date.now()}`;
    const authUrl = this.generateOAuthUrl(state);
    
    console.log('🔗 Generated OAuth URL:', authUrl);
    
    // Launch browser
    const browser = await puppeteer.launch({ 
      headless: false, // Set to true for production
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Navigate to OAuth URL
      console.log('🌐 Navigating to OAuth URL...');
      await page.goto(authUrl, { waitUntil: 'networkidle2' });
      
      // Wait for user to complete OAuth (or automate if credentials provided)
      console.log('⏳ Waiting for OAuth completion...');
      console.log('💡 Please complete the OAuth flow in the browser window');
      
      // Monitor for callback URL
      const callbackUrl = await page.waitForFunction(
        () => window.location.href.includes('/auth/callback'),
        { timeout: 300000 } // 5 minutes timeout
      );
      
      const finalUrl = page.url();
      console.log('✅ OAuth completed, callback URL:', finalUrl);
      
      // Extract authorization code
      const urlParams = new URLSearchParams(new URL(finalUrl).search);
      const code = urlParams.get('code');
      const returnedState = urlParams.get('state');
      
      if (!code) {
        throw new Error('No authorization code received');
      }
      
      if (returnedState !== state) {
        throw new Error('State mismatch - possible CSRF attack');
      }
      
      console.log('🎯 Authorization code extracted:', code.substring(0, 20) + '...');
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Store tokens in database
      const integrationId = await this.storeTokens(projectId, tokens);
      
      console.log('✅ Authentication completed successfully!');
      console.log('📊 Integration ID:', integrationId);
      
      return { success: true, integrationId, tokens };
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code) {
    console.log('🔄 Exchanging authorization code for tokens...');
    console.log('🔍 Debug - Client ID:', this.clientId);
    console.log('🔍 Debug - Redirect URI:', this.redirectUri);
    console.log('🔍 Debug - Code (first 20 chars):', code.substring(0, 20) + '...');
    
    const tokenRequest = {
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri
    };

    console.log('🔍 Debug - Request body:', new URLSearchParams(tokenRequest).toString());

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenRequest).toString()
    });

    console.log('🔍 Debug - Response status:', response.status);
    console.log('🔍 Debug - Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔍 Debug - Error response:', errorText);
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    console.log('✅ Tokens received successfully');
    console.log('🔍 Debug - Token response:', JSON.stringify(tokenData, null, 2));
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null, // Use refresh token if provided
      expiresIn: tokenData.expires_in,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    };
  }

  /**
   * Store tokens in database
   */
  async storeTokens(projectId, tokens, accountInfo = {}) {
    const db = await getDatabase();
    
    // Check if this is the first integration to set as primary
    const existingIntegrations = await db.all('SELECT COUNT(*) as count FROM integrations WHERE is_active = 1');
    const isFirstIntegration = existingIntegrations[0].count === 0;
    
    const result = await db.run(`
      INSERT INTO integrations 
      (project_id, account_name, account_email, jira_domain, access_token, refresh_token, expires_at, last_refresh_at, is_active, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId,
      accountInfo.accountName || 'New Account',
      accountInfo.accountEmail || 'user@example.com',
      accountInfo.jiraDomain || 'your-domain.atlassian.net',
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
      new Date().toISOString(),
      1,
      isFirstIntegration ? 1 : 0
    ]);

    console.log('💾 Tokens stored in database');
    console.log(`📊 Account: ${accountInfo.accountName || 'New Account'} (${isFirstIntegration ? 'PRIMARY' : 'SECONDARY'})`);
    return result.lastID;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(integrationId) {
    console.log(`🔄 Refreshing access token for integration: ${integrationId}`);
    
    const db = await getDatabase();
    const integration = await db.get(
      'SELECT * FROM integrations WHERE id = ? AND is_active = 1',
      [integrationId]
    );

    if (!integration) {
      throw new Error('Integration not found');
    }

    if (!integration.refresh_token) {
      console.log(`⚠️  No refresh token available for integration ${integrationId}`);
      throw new Error('No refresh token available - re-authentication required');
    }

    const refreshRequest = {
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: integration.refresh_token
    };

    console.log('🔄 Making refresh token request...');
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(refreshRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token refresh failed:', errorText);
      
      // Increment failure count
      await db.run(
        'UPDATE integrations SET refresh_failures = refresh_failures + 1 WHERE id = ?',
        [integrationId]
      );
      
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    console.log('✅ Token refresh successful');
    
    // Update tokens in database
    await db.run(`
      UPDATE integrations 
      SET access_token = ?, refresh_token = ?, expires_at = ?, last_refresh_at = ?, refresh_failures = 0
      WHERE id = ?
    `, [
      tokenData.access_token,
      tokenData.refresh_token || integration.refresh_token, // Keep old refresh token if not provided
      new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      new Date().toISOString(),
      integrationId
    ]);

    console.log('✅ Access token refreshed successfully');
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || integration.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    };
  }

  /**
   * Get all active integrations
   */
  async getActiveIntegrations() {
    const db = await getDatabase();
    return await db.all(
      'SELECT * FROM integrations WHERE is_active = 1'
    );
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(integration) {
    if (!integration.expires_at) return true;
    
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return expiresAt <= new Date(now.getTime() + bufferTime);
  }
}
