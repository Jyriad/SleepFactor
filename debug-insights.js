/**
 * Debug script to test insights computation logic locally
 * This replicates the edge function logic to see what's happening
 */

const { createClient } = require('@supabase/supabase-js');

// Use service role key for debugging (can access all data)
const SUPABASE_URL = 'https://alskvzepqyqnchgdltrv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// If no service key, provide instructions
if (!SUPABASE_SERVICE_KEY) {
  console.log('❌ Please set the SUPABASE_SERVICE_ROLE_KEY environment variable.');
  console.log('   You can find this in your Supabase Dashboard → Settings → API → service_role key');
  console.log('   Run: SUPABASE_SERVICE_ROLE_KEY=your-key-here node debug-insights.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugInsights(userId = null) {
  try {
    console.log('🔍 Starting insights debug...\n');

    // Find user to debug
    let targetUserId = userId;

    if (!targetUserId) {
      // Find users with active habits
      const { data: usersWithHabits, error: habitsError } = await supabase
        .from('habits')
        .select('user_id')
        .eq('is_active', true);

      if (habitsError) {
        console.log('❌ Error finding users:', habitsError);
        return;
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(usersWithHabits?.map(h => h.user_id) || [])];

      if (uniqueUserIds.length === 0) {
        console.log('❌ No users with active habits found.');
        return;
      }

      if (uniqueUserIds.length === 1) {
        targetUserId = uniqueUserIds[0];
        console.log(`👤 Found 1 user with active habits: ${targetUserId}\n`);
      } else {
        console.log(`👥 Found ${uniqueUserIds.length} users with active habits:`);
        uniqueUserIds.forEach((id, index) => console.log(`   ${index + 1}. ${id}`));
        console.log('\nPlease specify which user ID to debug:');
        console.log('Run: node debug-insights.js <user-id>');
        return;
      }
    } else {
      console.log(`👤 Debugging user: ${targetUserId}\n`);
    }

    // Test 1: Check active habits
    console.log('1️⃣ Checking active habits...');
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (habitsError) {
      console.log('❌ Error fetching habits:', habitsError);
      return;
    }

    console.log(`✅ Found ${habits.length} active habits:`);
    habits.forEach(habit => {
      console.log(`   - ${habit.name} (${habit.type}) - ID: ${habit.id}`);
    });
    console.log('');

    // Test 2: Check date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 2);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`2️⃣ Date range: ${startDateStr} to ${endDateStr} (2 years)\n`);

    // Test 3: Check habit logs
    console.log('3️⃣ Checking habit logs...');
    const { data: habitLogs, error: logsError } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (logsError) {
      console.log('❌ Error fetching habit logs:', logsError);
      return;
    }

    console.log(`✅ Found ${habitLogs.length} habit log entries`);

    // Group logs by habit
    const logsByHabit = {};
    habitLogs.forEach(log => {
      if (!logsByHabit[log.habit_id]) {
        logsByHabit[log.habit_id] = [];
      }
      logsByHabit[log.habit_id].push(log);
    });

    habits.forEach(habit => {
      const habitLogs = logsByHabit[habit.id] || [];
      console.log(`   - ${habit.name}: ${habitLogs.length} logs`);
    });
    console.log('');

    // Test 4: Check sleep data
    console.log('4️⃣ Checking sleep data...');
    const { data: sleepData, error: sleepError } = await supabase
      .from('sleep_data')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (sleepError) {
      console.log('❌ Error fetching sleep data:', sleepError);
      return;
    }

    console.log(`✅ Found ${sleepData.length} sleep records`);
    console.log(`   Date range: ${sleepData.length > 0 ? sleepData[0].date : 'N/A'} to ${sleepData.length > 0 ? sleepData[sleepData.length - 1].date : 'N/A'}`);
    console.log('');

    // Test 5: Check drug levels
    console.log('5️⃣ Checking drug levels...');
    const { data: drugLevels, error: drugError } = await supabase
      .from('drug_levels')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (drugError) {
      console.log('❌ Error fetching drug levels:', drugError);
      return;
    }

    console.log(`✅ Found ${drugLevels.length} drug level records\n`);

    // Test 6: Simulate habit processing
    console.log('6️⃣ Simulating habit processing...\n');

    // Create sleep data lookup
    const sleepByDate = {};
    sleepData.forEach(sleep => {
      sleepByDate[sleep.date] = sleep;
    });

    for (const habit of habits) {
      console.log(`🔍 Processing habit: ${habit.name} (${habit.type})`);

      // Get habit data
      let habitData;
      if (habit.type === 'quick_consumption') {
        habitData = drugLevels.filter(dl => dl.habit_id === habit.id);
        console.log(`   Using drug levels: ${habitData.length} records`);
      } else {
        habitData = habitLogs.filter(hl => hl.habit_id === habit.id);
        console.log(`   Using habit logs: ${habitData.length} records`);
      }

      if (habitData.length < 10) {
        console.log(`   ❌ Skipping - insufficient data (${habitData.length} < 10)`);
        continue;
      }

      // Simulate data matching
      const dataPoints = [];
      habitData.forEach(log => {
        // Date logic depends on habit type
        let sleepDataDate;
        if (habit.type === 'quick_consumption') {
          sleepDataDate = log.date;
        } else {
          const logDate = new Date(log.date);
          const nextDay = new Date(logDate);
          nextDay.setDate(nextDay.getDate() + 1);
          sleepDataDate = nextDay.toISOString().split('T')[0];
        }

        const sleep = sleepByDate[sleepDataDate];
        if (sleep) {
          // Check multiple sleep metrics
          const sleepMetrics = ['total_sleep_minutes', 'deep_sleep_minutes', 'light_sleep_minutes',
                               'rem_sleep_minutes', 'awake_minutes', 'awakenings_count', 'sleep_score'];

          for (const metric of sleepMetrics) {
            const sleepValue = sleep[metric];
            if (sleepValue !== null && sleepValue !== undefined && !isNaN(sleepValue)) {
              dataPoints.push({
                habitValue: getHabitValue(log, habit),
                sleepValue: sleepValue,
                date: log.date,
                metric: metric
              });
            }
          }
        }
      });

      console.log(`   📊 Collected ${dataPoints.length} data points`);

      if (dataPoints.length === 0) {
        console.log(`   ❌ No data points - date matching issue`);
        continue;
      }

      // Group by metric and test correlations
      const metricsTested = [];
      const sleepMetrics = ['total_sleep_minutes', 'deep_sleep_minutes', 'light_sleep_minutes',
                           'rem_sleep_minutes', 'awake_minutes', 'awakenings_count', 'sleep_score'];

      for (const metric of sleepMetrics) {
        const metricData = dataPoints.filter(dp => dp.metric === metric);
        if (metricData.length >= 5) {
          const habitValues = metricData.map(p => p.habitValue);
          const sleepValues = metricData.map(p => p.sleepValue);

          const correlation = calculatePearsonCorrelationSimple(habitValues, sleepValues);
          if (correlation && Math.abs(correlation.r) > 0.2) {
            metricsTested.push(`${metric}: r=${correlation.r.toFixed(3)} (✓)`);
          } else {
            metricsTested.push(`${metric}: r=${correlation.r ? correlation.r.toFixed(3) : 'N/A'} (✗)`);
          }
        } else {
          metricsTested.push(`${metric}: ${metricData.length} points (insufficient)`);
        }
      }

      console.log(`   📈 Correlation results:`);
      metricsTested.forEach(result => console.log(`      ${result}`));
      console.log('');
    }

    console.log('🏁 Debug complete!');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Helper functions
function getHabitValue(log, habit) {
  if (habit.type === 'binary') {
    return log.value && (log.value.toLowerCase() === 'yes' || log.value === '1' || log.value === true) ? 1 : 0;
  } else if (habit.type === 'numeric') {
    if (log.numeric_value !== null && log.numeric_value !== undefined) {
      return log.numeric_value;
    }
    const stringValue = String(log.value || '').trim();
    if (!stringValue || stringValue.startsWith('N') || stringValue.startsWith('n') ||
        stringValue === 'null' || stringValue === 'undefined' ||
        stringValue.includes(' ') || isNaN(Number(stringValue))) {
      return 0;
    }
    return parseFloat(stringValue);
  } else if (habit.type === 'quick_consumption') {
    return log.level_value || 0;
  } else if (habit.type === 'time') {
    const timeString = String(log.value || '').trim();
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return 0;
    }
    return hours * 60 + minutes;
  }
  return 0;
}

function calculatePearsonCorrelationSimple(x, y) {
  if (x.length !== y.length || x.length < 2) return null;

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return { r: 0, p: 1, n };

  const r = numerator / denominator;

  // Simplified p-value
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  const p = 2 * (1 - studentT(t, n - 2));

  return { r, p, n };
}

function studentT(t, df) {
  const x = df / (df + t * t);
  let p = 1 - 0.5 * Math.pow(x, df/2);
  for (let i = 0; i < 10; i++) {
    p = 0.5 + 0.5 * Math.sign(t) * (0.5 - p);
  }
  return p;
}

// Run the debug
const userIdArg = process.argv[2]; // Optional user ID from command line
debugInsights(userIdArg);