import { createClient } from '@supabase/supabase-js';

// Hardcoded values for testing (same as in config/supabase.js)
const SUPABASE_URL = 'https://alskvzepqyqnchgdltrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsc2t2emVwcXlxbmNoZ2RsdHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjgzNDgsImV4cCI6MjA2ODMwNDM0OH0.zze25ZyIIxWrdEfk5p0QKHc4kRbPc-FT5iyXu1aVm7Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkVolumeColumn() {
  try {
    console.log('Checking consumption_options table structure...');

    // Try to get a sample record to see all columns
    const { data, error } = await supabase
      .from('consumption_options')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying table:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('Sample record from consumption_options:');
      console.log(JSON.stringify(data[0], null, 2));

      // Check if volume_ml column exists
      const hasVolumeColumn = 'volume_ml' in data[0];
      console.log(`\n✅ volume_ml column exists: ${hasVolumeColumn}`);

      if (hasVolumeColumn) {
        console.log(`📏 Volume value: ${data[0].volume_ml} ml`);
      } else {
        console.log('❌ volume_ml column is missing from the database');
      }
    } else {
      console.log('No records found in consumption_options table');
    }

    // Also try to get all column names by querying information schema
    console.log('\n--- Checking table structure ---');
    const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
      table_name: 'consumption_options'
    });

    if (columnsError) {
      console.log('Could not get column info via RPC, trying direct query...');
    } else if (columns) {
      console.log('Columns in consumption_options table:');
      columns.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkVolumeColumn();
