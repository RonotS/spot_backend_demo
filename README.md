# Jira Backend Authentication Demo

A comprehensive Node.js backend application for Jira OAuth 2.0 authentication with multi-account support, automatic token refresh, and data synchronization.

## 🚀 Features

### 🔐 Authentication & Authorization
- **OAuth 2.0 Flow**: Complete Jira OAuth 2.0 (3LO) authentication
- **Multi-Account Support**: Manage multiple Jira accounts with isolated data
- **Automatic Token Refresh**: Background scheduler for token renewal
- **Account Switching**: Easy switching between different Jira accounts

### 📊 Data Synchronization
- **Comprehensive Sync**: Projects, issues, users, workflows, and more
- **Real-time Statistics**: Live data counts and analytics
- **Raw Data Explorer**: Browse and explore synced Jira data
- **Account Isolation**: Each account has completely separate data

### 🛠️ Technical Features
- **SQLite Database**: Local data storage with proper schema
- **RESTful API**: Complete API for frontend integration
- **Web Dashboard**: Built-in web interface for management
- **Health Monitoring**: Automatic health checks and error handling

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Jira Cloud account
- Atlassian Developer Console access

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/RonotS/spot_backend_demo.git
cd spot_backend_demo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
JIRA_CLIENT_ID=your_client_id_here
JIRA_CLIENT_SECRET=your_client_secret_here
JIRA_REDIRECT_URI=http://localhost:3000/auth/callback
JIRA_BASE_URL=https://your-domain.atlassian.net
PORT=3000
```

### 4. Initialize Database
```bash
npm run setup
```

### 5. Start the Application
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 🔧 Configuration

### Atlassian Developer Console Setup

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Create a new OAuth 2.0 (3LO) app
3. Set the redirect URI to: `http://localhost:3000/auth/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### Required Scopes
- `manage:jira-configuration`
- `manage:jira-data-provider`
- `manage:jira-project`
- `manage:jira-webhook`
- `offline_access`
- `read:jira-user`
- `read:jira-work`
- `write:jira-work`

## 📖 API Endpoints

### Authentication
- `POST /auth/start` - Start OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/start-with-account` - Start OAuth with account details

### Account Management
- `GET /api/accounts` - List all accounts
- `POST /api/accounts/:id/set-primary` - Set primary account
- `DELETE /api/accounts/:id` - Deactivate account
- `GET /api/current-account` - Get current account info

### Data Operations
- `GET /api/integrations` - List integrations
- `GET /api/integrations/:id/stats` - Get data statistics
- `GET /api/integrations/:id/raw-data` - Get raw data
- `POST /api/integrations/:id/sync` - Quick sync
- `POST /api/integrations/:id/comprehensive-sync` - Full sync
- `POST /api/integrations/:id/refresh-token` - Manual token refresh

### Health & Monitoring
- `GET /health` - Health check
- `GET /dashboard` - Web dashboard
- `GET /accounts` - Account management interface

## 🎯 Usage

### Web Dashboard
1. Open `http://localhost:3000/dashboard`
2. Click "Start OAuth Flow" to authenticate
3. Complete authentication in your browser
4. View synced data and statistics

### Account Management
1. Go to `http://localhost:3000/accounts`
2. Add new Jira accounts
3. Switch between accounts
4. Set primary account

### Data Synchronization
- **Automatic**: Runs every hour in the background
- **Manual**: Use the dashboard buttons for immediate sync
- **Account-Specific**: Each account syncs its own data

## 🏗️ Architecture

### Database Schema
- `integrations` - Account and token storage
- `jira_projects` - Project data
- `jira_issues` - Issue data
- `jira_users` - User data
- `jira_workflows` - Workflow data
- And more...

### Key Components
- `index.js` - Main application entry point
- `web-server.js` - Express server and API routes
- `auth-service.js` - OAuth authentication logic
- `scheduler.js` - Background token refresh
- `database.js` - Database initialization
- `comprehensive-sync.js` - Data synchronization

## 🔄 Background Processes

### Token Refresh Scheduler
- Runs every 30 minutes
- Automatically refreshes expired tokens
- Handles refresh failures gracefully

### Data Sync Scheduler
- Runs every hour
- Syncs all account data
- Maintains data freshness

### Health Monitoring
- Runs every 5 minutes
- Checks integration health
- Reports system status

## 🛡️ Security Features

- **Token Encryption**: Secure token storage
- **Account Isolation**: Complete data separation
- **Error Handling**: Graceful failure management
- **Health Checks**: Continuous monitoring

## 📊 Data Statistics

The application tracks and displays:
- Projects count
- Issues count
- Users count
- Issue types
- Priorities
- Statuses
- Workflows
- And more...

## 🚨 Troubleshooting

### Common Issues

1. **Token Exchange Errors**
   - Verify Client ID and Secret
   - Check redirect URI configuration
   - Ensure scopes are properly set

2. **Database Errors**
   - Run `npm run setup` to initialize database
   - Check database file permissions

3. **Sync Errors**
   - Verify Jira API access
   - Check account permissions
   - Review error logs

### Debug Mode
Enable debug logging by setting:
```env
DEBUG=true
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in this repository
- Check the troubleshooting section
- Review the API documentation

## 🔗 Related Links

- [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [OAuth 2.0 Documentation](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)

---

**Built with ❤️ for Jira integration and automation**



