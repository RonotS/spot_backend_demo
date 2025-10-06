import { initDatabase } from './database.js';
import { WebServer } from './web-server.js';
import { TokenRefreshScheduler } from './scheduler.js';
import { JiraAuthService } from './auth-service.js';
import './config.js'; // Load configuration

async function main() {
  console.log('🚀 Starting Jira Backend Auth Demo...');
  
  // Initialize database
  await initDatabase();
  console.log('✅ Database initialized');
  
  // Start web server
  const port = process.env.PORT || 3000;
  const webServer = new WebServer(port);
  webServer.start();
  
  // Start token refresh scheduler
  const scheduler = new TokenRefreshScheduler();
  scheduler.start();
  
  console.log('✅ All services started successfully!');
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   🌐 Dashboard: http://localhost:${port}/dashboard`);
  console.log(`   🔗 Health: http://localhost:${port}/health`);
  console.log(`   🔐 Auth Start: POST http://localhost:${port}/auth/start`);
  console.log(`   📊 Integrations: GET http://localhost:${port}/api/integrations`);
  console.log('');
  console.log('🔄 Scheduler running:');
  console.log('   - Token refresh: Every 30 minutes');
  console.log('   - Data sync: Every hour');
  console.log('   - Health check: Every 5 minutes');
  console.log('');
  console.log('💡 To test the system:');
  console.log('   1. Open http://localhost:3000/dashboard');
  console.log('   2. Click "Start OAuth Flow"');
  console.log('   3. Complete authentication in browser');
  console.log('   4. View synced data in dashboard');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
