import { getDatabase } from './database.js';
import { JiraAuthService } from './auth-service.js';

async function testTokenRefresh() {
  console.log('🧪 Testing Token Refresh Process');
  console.log('================================\n');

  try {
    const db = await getDatabase();
    const authService = new JiraAuthService();

    // 1. Show current token status
    console.log('📊 Current Token Status:');
    console.log('------------------------');
    const integrations = await db.all('SELECT * FROM integrations WHERE is_active = 1');
    
    for (const integration of integrations) {
      const expiresAt = new Date(integration.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt - now;
      const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
      const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));
      
      console.log(`Integration ${integration.id}:`);
      console.log(`  - Project: ${integration.project_id}`);
      console.log(`  - Expires: ${integration.expires_at}`);
      console.log(`  - Time until expiry: ${hoursUntilExpiry}h ${minutesUntilExpiry % 60}m`);
      console.log(`  - Last refresh: ${integration.last_refresh_at}`);
      console.log(`  - Refresh failures: ${integration.refresh_failures || 0}`);
      console.log(`  - Needs refresh: ${authService.needsRefresh(integration) ? 'YES' : 'NO'}`);
      console.log('');
    }

    // 2. Simulate scheduler token refresh check
    console.log('🔄 Simulating Scheduler Token Refresh Check:');
    console.log('--------------------------------------------');
    
    for (const integration of integrations) {
      console.log(`\n🔍 Checking Integration ${integration.id}:`);
      
      if (authService.needsRefresh(integration)) {
        console.log(`  ⚠️  Token needs refresh (expires in ${Math.round((new Date(integration.expires_at) - new Date()) / (1000 * 60))} minutes)`);
        
        try {
          console.log(`  🔄 Attempting token refresh...`);
          const newTokens = await authService.refreshAccessToken(integration.id);
          console.log(`  ✅ Token refresh successful!`);
          console.log(`  📅 New expiry: ${newTokens.expiresAt}`);
          
          // Show updated token info
          const updatedIntegration = await db.get(
            'SELECT * FROM integrations WHERE id = ?',
            [integration.id]
          );
          
          const newExpiresAt = new Date(updatedIntegration.expires_at);
          const newTimeUntilExpiry = newExpiresAt - new Date();
          const newHoursUntilExpiry = Math.round(newTimeUntilExpiry / (1000 * 60 * 60));
          
          console.log(`  📊 Updated token info:`);
          console.log(`     - New expiry: ${updatedIntegration.expires_at}`);
          console.log(`     - Time until expiry: ${newHoursUntilExpiry}h`);
          console.log(`     - Last refresh: ${updatedIntegration.last_refresh_at}`);
          console.log(`     - Refresh failures: ${updatedIntegration.refresh_failures || 0}`);
          
        } catch (error) {
          console.log(`  ❌ Token refresh failed: ${error.message}`);
          
          // Increment failure count
          await db.run(
            'UPDATE integrations SET refresh_failures = refresh_failures + 1 WHERE id = ?',
            [integration.id]
          );
          
          const updatedIntegration = await db.get(
            'SELECT * FROM integrations WHERE id = ?',
            [integration.id]
          );
          
          console.log(`  📊 Failure count: ${updatedIntegration.refresh_failures}`);
          
          // Check if we should deactivate
          if (updatedIntegration.refresh_failures >= 3) {
            console.log(`  🚫 Deactivating integration ${integration.id} due to repeated failures`);
            await db.run(
              'UPDATE integrations SET is_active = 0 WHERE id = ?',
              [integration.id]
            );
          }
        }
      } else {
        console.log(`  ✅ Token is still valid (expires in ${Math.round((new Date(integration.expires_at) - new Date()) / (1000 * 60))} minutes)`);
      }
    }

    // 3. Show final status
    console.log('\n📊 Final Token Status:');
    console.log('----------------------');
    const finalIntegrations = await db.all('SELECT * FROM integrations WHERE is_active = 1');
    
    if (finalIntegrations.length === 0) {
      console.log('❌ No active integrations found');
    } else {
      for (const integration of finalIntegrations) {
        const expiresAt = new Date(integration.expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt - now;
        const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
        
        console.log(`Integration ${integration.id}:`);
        console.log(`  - Expires: ${integration.expires_at}`);
        console.log(`  - Time until expiry: ${hoursUntilExpiry}h`);
        console.log(`  - Refresh failures: ${integration.refresh_failures || 0}`);
        console.log(`  - Status: ${integration.is_active ? 'ACTIVE' : 'INACTIVE'}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTokenRefresh();

