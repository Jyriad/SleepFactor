import { createClient } from '@supabase/supabase-js';

// Hardcoded values for testing (same as in config/supabase.js)
const SUPABASE_URL = 'https://alskvzepqyqnchgdltrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsc2t2emVwcXlxbmNoZ2RsdHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MjgzNDgsImV4cCI6MjA2ODMwNDM0OH0.zze25ZyIIxWrdEfk5p0QKHc4kRbPc-FT5iyXu1aVm7Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkServingUnits() {
  try {
    console.log('Checking consumption_options table with serving units...');

    // Get all consumption options to see serving units
    const { data, error } = await supabase
      .from('consumption_options')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error querying table:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log(`Found ${data.length} consumption options:\n`);

      data.forEach((option, index) => {
        console.log(`${index + 1}. ${option.name}`);
        console.log(`   - Drug amount: ${option.drug_amount} ${option.habit_id ? 'caffeine units' : 'alcohol units'}`);
        console.log(`   - Volume: ${option.volume_ml || 'N/A'} ${option.serving_unit}`);
        console.log(`   - Icon: ${option.icon}`);
        console.log(`   - Custom: ${option.is_custom}`);
        console.log('');
      });

      // Check if serving_unit column exists
      const hasServingUnitColumn = data.every(option => 'serving_unit' in option);
      console.log(`✅ serving_unit column exists: ${hasServingUnitColumn}`);

      // Show some examples
      const examples = data.slice(0, 3);
      console.log('\n📋 Examples:');
      examples.forEach(example => {
        console.log(`   ${example.name}: ${example.volume_ml || 'N/A'} ${example.serving_unit}`);
      });

    } else {
      console.log('No records found in consumption_options table');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkServingUnits();
