import { initDatabase, closeDatabase } from './database.js';

async function setup() {
  console.log('🔧 Setting up database...');
  
  try {
    await initDatabase();
    console.log('✅ Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

setup();





