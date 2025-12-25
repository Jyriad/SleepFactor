import { createClient } from '@supabase/supabase-js';

// Hardcoded values for testing (same as in config/supabase.js)
const SUPABASE_URL = 'https://alskvzepqyqnchgdltrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsc2t2emVwcXlxbmNoZ2RsdHJ2Iiwicm9sZSI6MjA2ODMwNDM0OH0.zze25ZyIIxWrdEfk5p0QKHc4kRbPc-FT5iyXu1aVm7Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDrugUnits() {
  try {
    console.log('Checking consumption_options table with drug units...');

    // Get all consumption options to see drug units
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
        console.log(`   - Drug amount: ${option.drug_amount} ${option.drug_unit}`);
        console.log(`   - Serving: ${option.volume_ml || 'N/A'} ${option.serving_unit}`);
        console.log(`   - Custom: ${option.is_custom}`);
        console.log('');
      });

      // Check if drug_unit column exists
      const hasDrugUnitColumn = data.every(option => 'drug_unit' in option);
      console.log(`✅ drug_unit column exists: ${hasDrugUnitColumn}`);

      // Show some examples
      const examples = data.slice(0, 3);
      console.log('\n📋 Examples:');
      examples.forEach(example => {
        console.log(`   ${example.name}: ${example.drug_amount} ${example.drug_unit}`);
      });

    } else {
      console.log('No records found in consumption_options table');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkDrugUnits();
