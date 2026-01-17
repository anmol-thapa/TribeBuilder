// Database Migration Script for TribeBuilders
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration(filename) {
  const sqlPath = path.join(__dirname, '../src/db', filename);

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Migration file not found: ${filename}`);
    return false;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`\n📄 Running migration: ${filename}`);
  console.log('━'.repeat(60));

  try {
    await pool.query(sql);
    console.log(`✅ Migration successful: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error('Error:', error.message);

    // If table already exists, it's probably not a critical error
    if (error.message.includes('already exists')) {
      console.log('⚠️  Some tables already exist, continuing...');
      return true;
    }

    return false;
  }
}

async function testConnection() {
  console.log('\n🔌 Testing database connection...');
  console.log('━'.repeat(60));

  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful!');
    console.log(`📅 Server time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Check DATABASE_URL in .env file');
    console.error('  2. Verify database credentials');
    console.error('  3. Ensure database accepts connections from your IP');
    return false;
  }
}

async function checkExistingTables() {
  console.log('\n📊 Checking existing tables...');
  console.log('━'.repeat(60));

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} existing tables:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('No tables found. Database is empty.');
    }

    return result.rows;
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    return [];
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         TribeBuilders Database Migration Tool             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    process.exit(1);
  }

  // Check existing tables
  await checkExistingTables();

  // Run migrations
  console.log('\n🚀 Starting migrations...');
  console.log('━'.repeat(60));

  const migrations = [
    '001_initial_schema.sql',
    '002_ai_content_enhancements.sql'
  ];

  let successCount = 0;
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) successCount++;
  }

  // Final check
  console.log('\n📊 Final database state:');
  console.log('━'.repeat(60));
  await checkExistingTables();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  if (successCount === migrations.length) {
    console.log('║             ✅ All migrations completed!                  ║');
  } else {
    console.log('║     ⚠️  Some migrations had issues. Check logs above.     ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await pool.end();
  process.exit(successCount === migrations.length ? 0 : 1);
}

// Run migrations
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  pool.end();
  process.exit(1);
});
