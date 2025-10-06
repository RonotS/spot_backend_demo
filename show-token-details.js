import { getDatabase } from './database.js';

async function showTokenDetails() {
  console.log('🔍 Detailed Token Information');
  console.log('==============================\n');

  try {
    const db = await getDatabase();
    const integrations = await db.all('SELECT * FROM integrations ORDER BY id');

    if (integrations.length === 0) {
      console.log('❌ No integrations found');
      return;
    }

    for (const integration of integrations) {
      const expiresAt = new Date(integration.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt - now;
      const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
      const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));
      
      console.log(`🔑 Integration ${integration.id}:`);
      console.log(`   Project: ${integration.project_id}`);
      console.log(`   Status: ${integration.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE'}`);
      console.log(`   Created: ${integration.created_at}`);
      console.log(`   Last Refresh: ${integration.last_refresh_at}`);
      console.log(`   Expires: ${integration.expires_at}`);
      
      if (timeUntilExpiry > 0) {
        console.log(`   Time Until Expiry: ${hoursUntilExpiry}h ${minutesUntilExpiry % 60}m`);
        console.log(`   Token Status: 🟢 VALID`);
      } else {
        console.log(`   Time Since Expiry: ${Math.abs(hoursUntilExpiry)}h ${Math.abs(minutesUntilExpiry % 60)}m ago`);
        console.log(`   Token Status: 🔴 EXPIRED`);
      }
      
      console.log(`   Refresh Failures: ${integration.refresh_failures || 0}`);
      console.log(`   Access Token: ${integration.access_token ? '***' + integration.access_token.slice(-8) : 'NONE'}`);
      console.log(`   Refresh Token: ${integration.refresh_token ? '***' + integration.refresh_token.slice(-8) : 'NONE'}`);
      console.log('');
    }

    // Show summary
    const activeIntegrations = integrations.filter(i => i.is_active);
    const expiredIntegrations = integrations.filter(i => {
      const expiresAt = new Date(i.expires_at);
      return expiresAt <= new Date();
    });

    console.log('📊 Summary:');
    console.log(`   Total Integrations: ${integrations.length}`);
    console.log(`   Active: ${activeIntegrations.length}`);
    console.log(`   Inactive: ${integrations.length - activeIntegrations.length}`);
    console.log(`   Expired: ${expiredIntegrations.length}`);
    console.log(`   Valid: ${activeIntegrations.length - expiredIntegrations.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showTokenDetails();

