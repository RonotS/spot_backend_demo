// Configuration file for Jira Backend Auth Demo
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  // Jira OAuth Configuration
  JIRA_CLIENT_ID: process.env.JIRA_CLIENT_ID || 'your_client_id_here',
  JIRA_CLIENT_SECRET: process.env.JIRA_CLIENT_SECRET || 'your_client_secret_here',
  JIRA_REDIRECT_URI: process.env.JIRA_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  JIRA_BASE_URL: process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net',
  
  // Optional: For automated login
  JIRA_USERNAME: 'your_jira_username',
  JIRA_PASSWORD: 'your_jira_password',
  
  // Server Configuration
  PORT: 3000,
  NODE_ENV: 'development'
};

// Set environment variables
Object.entries(config).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});
