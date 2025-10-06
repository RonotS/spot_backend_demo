import { getDatabase } from './database.js';

async function fixIntegrations() {
  try {
    const db = await getDatabase();
    
    console.log('🔧 Deactivating failed integration...');
    await db.run('UPDATE integrations SET is_active = 0 WHERE id = 1');
    console.log('✅ Integration 1 deactivated');
    
    console.log('🔍 Current active integrations:');
    const active = await db.all('SELECT id, project_id, expires_at, refresh_failures FROM integrations WHERE is_active = 1');
    active.forEach(integration => {
      const expiresAt = new Date(integration.expires_at);
      const now = new Date();
      const hoursUntilExpiry = Math.round((expiresAt - now) / (1000 * 60 * 60));
      console.log(`  - ID: ${integration.id}, Expires in: ${hoursUntilExpiry}h, Failures: ${integration.refresh_failures}`);
    });
    
    console.log('✅ Integration cleanup completed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixIntegrations();

