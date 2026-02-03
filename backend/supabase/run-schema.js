const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSchema() {
  console.log('🚀 Connecting to Supabase PostgreSQL (IPv4)...');

  const client = new Client({
    host: 'db.vpfayzzjnegdefjrnyoc.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'ivanmaimuna123',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    // Force IPv4
    family: 4
  });

  try {
    await client.connect();
    console.log('✅ Connected!\n');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Running schema...\n');

    // Execute the entire schema
    await client.query(schema);

    console.log('✅ Schema executed successfully!\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📊 Tables created:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check default tenant
    const tenant = await client.query(`SELECT * FROM tenants LIMIT 1`);
    if (tenant.rows.length > 0) {
      console.log(`\n🏢 Default tenant: "${tenant.rows[0].name}" (${tenant.rows[0].id})`);
    }

    console.log('\n🎉 Supabase database is ready!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. This is OK if you ran this before.');
    }
  } finally {
    await client.end();
  }
}

runSchema();
