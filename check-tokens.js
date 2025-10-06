import { getDatabase } from './database.js';

async function checkTokens() {
  try {
    const db = await getDatabase();
    const integrations = await db.all('SELECT id, project_id, expires_at, last_refresh_at, refresh_failures, is_active FROM integrations WHERE is_active = 1 ORDER BY id DESC');
    
    console.log('🔍 Token Status:');
    integrations.forEach(integration => {
      const expiresAt = new Date(integration.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt - now;
      const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
      
      console.log(`  Integration ${integration.id}:`);
      console.log(`    - Project: ${integration.project_id}`);
      console.log(`    - Expires: ${integration.expires_at}`);
      console.log(`    - Hours until expiry: ${hoursUntilExpiry}`);
      console.log(`    - Last refresh: ${integration.last_refresh_at}`);
      console.log(`    - Refresh failures: ${integration.refresh_failures}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTokens();

