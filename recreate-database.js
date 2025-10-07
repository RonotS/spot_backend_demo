import { initDatabase, closeDatabase } from './database.js';
import fs from 'fs';

async function recreateDatabase() {
  console.log('🔄 Recreating database with new constraints...');
  
  try {
    // Backup existing database if it exists
    if (fs.existsSync('./jira_auth.db')) {
      const backupName = `./jira_auth_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      fs.copyFileSync('./jira_auth.db', backupName);
      console.log(`📦 Database backed up to: ${backupName}`);
    }

    // Remove existing database
    if (fs.existsSync('./jira_auth.db')) {
      fs.unlinkSync('./jira_auth.db');
      console.log('🗑️ Removed existing database');
    }

    // Create new database with updated schema
    await initDatabase();
    console.log('✅ Database recreated successfully with unique constraints!');
    console.log('🔒 All tables now have proper unique constraints to prevent duplicates');
    
  } catch (error) {
    console.error('❌ Database recreation failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

recreateDatabase();
