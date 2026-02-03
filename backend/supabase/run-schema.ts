/**
 * Run Supabase Schema
 *
 * Executes the schema.sql file against your Supabase database.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://vpfayzzjnegdefjrnyoc.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZmF5enpqbmVnZGVmanJueW9jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEzMDA4NSwiZXhwIjoyMDg1NzA2MDg1fQ.akkm9U6rHYKhKcLgYIuKm6DzRUycX9OiJH2jhQFEpjs';

async function runSchema() {
  console.log('🚀 Connecting to Supabase...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Read schema file
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  console.log('📄 Schema loaded, executing...\n');

  // Split into individual statements (handle multi-line statements)
  const statements = schema
    .split(/;[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let success = 0;
  let failed = 0;

  for (const statement of statements) {
    // Skip empty or comment-only statements
    if (!statement || statement.startsWith('--')) continue;

    const preview = statement.substring(0, 60).replace(/\n/g, ' ');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

      if (error) {
        // Try direct execution for DDL statements
        const { error: error2 } = await supabase.from('_exec').select().throwOnError();
        console.log(`⚠️  ${preview}... (may need manual execution)`);
        failed++;
      } else {
        console.log(`✅ ${preview}...`);
        success++;
      }
    } catch (e) {
      // Expected - RPC won't work for DDL, need to use SQL Editor
      failed++;
    }
  }

  console.log(`\n📊 Results: ${success} succeeded, ${failed} need manual execution`);
  console.log('\n⚠️  DDL statements (CREATE TABLE, etc.) must be run in SQL Editor.');
  console.log('📋 Opening schema for you to copy...\n');
}

runSchema().catch(console.error);
