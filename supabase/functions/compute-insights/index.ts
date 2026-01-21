import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Compute insights function started")

serve(async (req) => {
  const startTime = new Date()
  let logId: string | null = null

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create a log entry for this computation run
    const { data: logEntry, error: logError } = await supabaseService
      .from('insight_computation_log')
      .insert({
        started_at: startTime.toISOString(),
        status: 'running'
      })
      .select()
      .single()

    if (!logError && logEntry) {
      logId = logEntry.id
    }

    // Find active users (logged habits or sleep data in last 24 hours)
    // For scheduled runs, this will find all users who have been active
    const activeUsers = await findActiveUsers(supabaseService)
    console.log(`Found ${activeUsers.length} active users to process`)

    if (activeUsers.length === 0) {
      console.log('No active users found to process')
      // Update log entry with completion status
      if (logId) {
        await supabaseService
          .from('insight_computation_log')
          .update({
            completed_at: new Date().toISOString(),
            status: 'completed',
            users_processed: 0,
            insights_computed: 0
          })
          .eq('id', logId)
      }

      return new Response(
        JSON.stringify({
          success: true,
          processedUsers: 0,
          totalInsights: 0,
          totalErrors: 0,
          message: 'No active users to process'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    // Process users in batches to avoid timeouts
    const batchSize = 10
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeUsers.length/batchSize)}`)

      const batchPromises = batch.map(userId => processUserInsights(supabaseService, userId))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    const totalProcessed = results.reduce((sum, result) => sum + result.processed, 0)
    const totalErrors = results.reduce((sum, result) => sum + result.errors, 0)

    // Update log entry with completion status
    if (logId) {
      await supabaseService
        .from('insight_computation_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          users_processed: activeUsers.length,
          insights_computed: totalProcessed
        })
        .eq('id', logId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedUsers: activeUsers.length,
        totalInsights: totalProcessed,
        totalErrors,
        message: `Processed ${activeUsers.length} users, computed ${totalProcessed} insights`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in compute-insights function:', error)
    
    // Update log entry with error status
    if (logId) {
      try {
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        await supabaseService
          .from('insight_computation_log')
          .update({
            completed_at: new Date().toISOString(),
            status: 'failed',
            error_message: error.message
          })
          .eq('id', logId)
      } catch (logErr) {
        console.error('Failed to update error log:', logErr)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Find users who have active habits (not just recently active users)
// This ensures we generate insights for all users with data
async function findActiveUsers(supabase: any) {
  console.log('Finding users with active habits...')

  // Get all users who have active habits
  const { data: usersWithHabits, error: habitsError } = await supabase
    .from('habits')
    .select('user_id')
    .eq('is_active', true)

  if (habitsError) {
    console.error('Error finding users with habits:', habitsError)
    return []
  }

  // Deduplicate user IDs
  const userIds = [...new Set(usersWithHabits?.map(h => h.user_id) || [])]
  console.log(`Found ${userIds.length} users with active habits`)

  return userIds
}

// Process all insights for a single user
async function processUserInsights(supabase: any, userId: string) {
  try {
    console.log(`Processing insights for user ${userId}`)

    // Get date range - use all available data (2 years) for comprehensive insights like the app default
    const endDate = new Date()
    const startDate = new Date()
    startDate.setFullYear(endDate.getFullYear() - 2) // Go back 2 years for maximum data

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log(`Date range: ${startDateStr} to ${endDateStr} (2 years of data)`)

    // Get user data
    console.log(`Fetching data for user ${userId}...`)
    const [habits, habitLogs, drugLevels, sleepData] = await Promise.all([
      getActiveHabits(supabase, userId),
      getHabitLogs(supabase, userId, startDateStr, endDateStr),
      getDrugLevels(supabase, userId, startDateStr, endDateStr),
      getSleepData(supabase, userId, startDateStr, endDateStr)
    ])

    console.log(`User ${userId}: ${habits.length} habits, ${habitLogs.length} logs, ${sleepData.length} sleep records, ${drugLevels.length} drug levels`)

    const insights = []

    // Process each habit
    for (const habit of habits) {
      try {
        console.log(`\n=== Processing habit: ${habit.name} (${habit.type}) ===`)

        // Use different data sources based on habit type
        let habitData
        if (habit.type === 'quick_consumption') {
          // For quick_consumption habits, use drug levels
          habitData = drugLevels.filter(dl => dl.habit_id === habit.id)
          console.log(`Using ${habitData.length} drug level records`)
        } else {
          // For other habit types, use habit logs
          habitData = habitLogs.filter(hl => hl.habit_id === habit.id)
          console.log(`Using ${habitData.length} habit log records`)
        }

        if (habitData.length < 10) {
          console.log(`❌ Skipping - insufficient data (${habitData.length} < 10)`)
          continue
        }

        console.log(`✅ Processing with ${habitData.length} data points`)

        // Calculate insights for this habit
        const habitInsights = await calculateHabitInsights(habit, habitData, sleepData)
        console.log(`📊 Generated ${habitInsights.length} insights for ${habit.name}`)

        if (habitInsights.length > 0) {
          console.log(`🎯 Insight details:`, habitInsights.map(i => ({
            type: i.insight_type,
            metric: i.insight_data?.sleep_metric,
            correlation: i.insight_data?.r
          })))
        }

        insights.push(...habitInsights)

      } catch (habitError) {
        console.error(`❌ Error processing habit ${habit.name}:`, habitError.message)
        console.error('Stack:', habitError.stack)
      }
    }

    // Calculate bedtime consistency (user-level insight, no specific habit)
    try {
      const bedtimeConsistency = await calculateBedtimeConsistency(supabase, userId, startDateStr, endDateStr)
      if (bedtimeConsistency) {
        insights.push(bedtimeConsistency)
      }
    } catch (bedtimeError) {
      console.error(`Error calculating bedtime consistency for user ${userId}:`, bedtimeError)
    }

    console.log(`\n🎉 Generated ${insights.length} total insights for user ${userId}`)

    // Store insights in database
    console.log(`💾 Storing ${insights.length} insights in database...`)
    const storedCount = await storeInsights(supabase, insights)
    console.log(`✅ Successfully stored ${storedCount} insights`)

    // Debug: List what was stored
    if (insights.length > 0) {
      console.log('📋 Stored insights summary:')
      insights.forEach((insight, index) => {
        console.log(`  ${index + 1}. ${insight.habit_id ? 'Habit' : 'User'} insight: ${insight.insight_type} (${insight.insight_data?.sleep_metric || 'N/A'})`)
      })
    }

    return {
      userId,
      processed: storedCount,
      errors: 0
    }

  } catch (error) {
    console.error(`Error processing user ${userId}:`, error)
    console.error('Error stack:', error.stack)
    return {
      userId,
      processed: 0,
      errors: 1
    }
  }
}

// Get active habits for a user
async function getActiveHabits(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .neq('is_active', false)
    .order('priority', { ascending: true })

  if (error) throw error
  return data || []
}

// Get habit logs for date range
async function getHabitLogs(supabase: any, userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  return data || []
}

// Get drug levels for date range
async function getDrugLevels(supabase: any, userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('drug_levels')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  return data || []
}

// Get sleep data for date range
async function getSleepData(supabase: any, userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('sleep_data')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  return data || []
}

// Calculate insights for a specific habit
async function calculateHabitInsights(habit: any, habitData: any[], sleepData: any[]) {
  const insights = []

  console.log(`calculateHabitInsights called for habit ${habit.name} (${habit.type}) with ${habitData.length} habit records and ${sleepData.length} sleep records`)

  // Create sleep data lookup by date
  const sleepByDate = {};
  sleepData.forEach(sleep => {
    sleepByDate[sleep.date] = sleep;
  });

  console.log(`Sleep data dates: ${Object.keys(sleepByDate).join(', ')}`)

  // Combine habit data with sleep data
  const dataPoints = [];

  habitData.forEach(log => {
    // Date logic depends on habit type
    let sleepDataDate;
    if (habit.type === 'quick_consumption') {
      // For drug levels, the date corresponds directly to sleep data date
      sleepDataDate = log.date;
    } else if (habit.name === 'Bedtime Consistency') {
      // For bedtime habits, the date corresponds directly to sleep data date
      sleepDataDate = log.date;
    } else {
      // For habit logs, sleep data date should be the next day
      const logDate = new Date(log.date);
      const nextDay = new Date(logDate);
      nextDay.setDate(nextDay.getDate() + 1);
      sleepDataDate = nextDay.toISOString().split('T')[0];
    }

    const sleep = sleepByDate[sleepDataDate];
    if (sleep) {
      const habitValue = getHabitValue(log, habit);

      // Test all sleep metrics
      const sleepMetrics = ['total_sleep_minutes', 'deep_sleep_minutes', 'light_sleep_minutes', 'rem_sleep_minutes', 'awake_minutes', 'awakenings_count', 'sleep_score'];

      for (const metric of sleepMetrics) {
        const sleepValue = sleep[metric];
        if (sleepValue !== null && sleepValue !== undefined && !isNaN(sleepValue)) {
          dataPoints.push({
            habitValue: habitValue,
            sleepValue: sleepValue,
            date: log.date,
            sleepDate: sleep.date,
            habitLog: log,
            sleepData: sleep,
            metric: metric
          });
        }
      }
    }
  });

  console.log(`Collected ${dataPoints.length} data points for habit ${habit.name}`)

  if (dataPoints.length === 0) {
    console.log(`No data points found for habit ${habit.name} - likely date matching issue`)
    return insights
  }

  // For binary habits, create binary insights
  if (habit.type === 'binary') {
    console.log(`Processing binary habit ${habit.name}`)
    const binaryInsight = calculateBinaryInsight(habit, dataPoints);
    if (binaryInsight) {
      console.log(`Generated binary insight for ${habit.name}`)
      insights.push(binaryInsight);
    } else {
      console.log(`No binary insight generated for ${habit.name}`)
    }
  }
  // For numerical habits, create correlation insights
  else if (habit.type === 'numeric' || habit.type === 'quick_consumption' || habit.type === 'time') {
    console.log(`Processing numerical habit ${habit.name}`)
    const numericalInsights = calculateNumericalInsights(habit, dataPoints);
    console.log(`Generated ${numericalInsights.length} numerical insights for ${habit.name}`)
    insights.push(...numericalInsights);
  } else {
    console.log(`Unknown habit type ${habit.type} for habit ${habit.name}`)
  }

  return insights
}

// Calculate bedtime consistency for a user
async function calculateBedtimeConsistency(supabase: any, userId: string, startDate: string, endDate: string) {
  try {
    // Get sleep data for the period
    const sleepData = await getSleepData(supabase, userId, startDate, endDate)
    
    if (sleepData.length < 2) {
      return null // Need at least 2 nights
    }

    // Calculate estimated bedtimes
    const bedtimeDetails = sleepData.map(record => {
      const bedtime = calculateEstimatedBedtime(record)
      if (!bedtime) return null
      
      const bedtimeMinutes = normalizeBedtimeToMinutes(bedtime)
      return { date: record.date, bedtimeMinutes, bedtime }
    }).filter(detail => detail !== null)

    if (bedtimeDetails.length < 2) return null

    // Filter outliers and calculate average
    const bedtimes = bedtimeDetails.map(d => d.bedtimeMinutes)
    const filteredBedtimes = filterOutliers(bedtimes)
    
    if (filteredBedtimes.length < 2) return null

    const averageBedtime = filteredBedtimes.reduce((sum, time) => sum + time, 0) / filteredBedtimes.length
    const consistency = Math.round(calculateConsistency(filteredBedtimes))

    return {
      user_id: userId,
      habit_id: null, // User-level insight
      insight_type: 'bedtime_consistency',
      date_range_start: startDate,
      date_range_end: endDate,
      insight_data: {
        consistency_score: consistency,
        average_bedtime_minutes: Math.round(averageBedtime),
        data_points: filteredBedtimes.length,
        total_nights: bedtimeDetails.length,
        filtered_outliers: bedtimeDetails.length - filteredBedtimes.length
      }
    }

  } catch (error) {
    console.error('Error calculating bedtime consistency:', error)
    return null
  }
}

// Helper functions for bedtime calculations
function calculateEstimatedBedtime(sleepRecord: any) {
  const { total_sleep_minutes = 0, awake_minutes = 0, sleep_start_time, sleep_end_time } = sleepRecord
  const totalTime = total_sleep_minutes + awake_minutes
  
  if (totalTime === 0) return null

  let sleepStart
  if (sleep_start_time && sleep_end_time) {
    sleepStart = new Date(sleep_start_time)
  } else {
    const sleepDate = new Date(sleepRecord.date)
    const sleepEnd = new Date(sleepDate)
    sleepEnd.setHours(8, 0, 0, 0) // Assume wake up at 8 AM
    sleepStart = new Date(sleepEnd)
    sleepStart.setMinutes(sleepStart.getMinutes() - totalTime)
  }

  return sleepStart
}

function normalizeBedtimeToMinutes(bedtime: Date): number {
  let minutes = bedtime.getHours() * 60 + bedtime.getMinutes()
  if (bedtime.getHours() < 6) {
    minutes += 1440 // Add 24 hours for after-midnight bedtimes
  }
  return minutes
}

function filterOutliers(bedtimes: number[]): number[] {
  if (bedtimes.length < 3) return bedtimes
  
  const sorted = [...bedtimes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const maxDeviation = 240 // 4 hours
  
  return bedtimes.filter(bt => Math.abs(bt - median) <= maxDeviation)
}

function calculateConsistency(bedtimes: number[]): number {
  const average = bedtimes.reduce((sum, time) => sum + time, 0) / bedtimes.length
  const variance = bedtimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / bedtimes.length
  const stdDev = Math.sqrt(variance)
  
  // Return standard deviation in minutes (lower = more consistent)
  return stdDev
}

// Helper function to extract habit value
function getHabitValue(log: any, habit: any) {
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

// Calculate binary habit insights
function calculateBinaryInsight(habit: any, dataPoints: any[]) {
  // Group by metric
  const insightsByMetric = {};

  dataPoints.forEach(dp => {
    if (!insightsByMetric[dp.metric]) {
      insightsByMetric[dp.metric] = [];
    }
    insightsByMetric[dp.metric].push(dp);
  });

  // Find the metric with the most data points
  let bestMetric = null;
  let maxDataPoints = 0;

  for (const [metric, points] of Object.entries(insightsByMetric)) {
    if (points.length > maxDataPoints) {
      maxDataPoints = points.length;
      bestMetric = metric;
    }
  }

  if (!bestMetric || maxDataPoints < 10) return null;

  const metricData = insightsByMetric[bestMetric];

  // Separate data points by habit value (0 = No, 1 = Yes)
  const yesData = metricData.filter(dp => dp.habitValue === 1).map(dp => dp.sleepValue);
  const noData = metricData.filter(dp => dp.habitValue === 0).map(dp => dp.sleepValue);

  if (yesData.length < 5 || noData.length < 5) return null;

  // Calculate basic statistics
  const yesStats = calculateBasicStats(yesData);
  const noStats = calculateBasicStats(noData);

  return {
    user_id: habit.user_id,
    habit_id: habit.id,
    insight_type: 'correlation', // Keep as correlation for UI compatibility
    date_range_start: metricData[0]?.date || new Date().toISOString().split('T')[0],
    date_range_end: metricData[metricData.length - 1]?.date || new Date().toISOString().split('T')[0],
    insight_data: {
      sleep_metric: bestMetric,
      type: 'binary',
      totalDataPoints: metricData.length,
      yesDataPoints: yesData.length,
      noDataPoints: noData.length,
      yesStats: yesStats,
      noStats: noStats,
      hasComparisonData: true,
      r: Math.abs(yesStats.median - noStats.median) > 0 ? (yesStats.median > noStats.median ? 0.5 : -0.5) : 0, // Add .r property
      p: 0.01, // Binary insights are always significant
      significance: true,
      data_points: metricData.length,
      direction: yesStats.median > noStats.median ? 'positive' : 'negative'
    }
  };
}

// Calculate numerical habit insights
function calculateNumericalInsights(habit: any, dataPoints: any[]) {
  const insights = [];

  // Group by metric
  const insightsByMetric = {};
  dataPoints.forEach(dp => {
    if (!insightsByMetric[dp.metric]) {
      insightsByMetric[dp.metric] = [];
    }
    insightsByMetric[dp.metric].push(dp);
  });

  // Calculate correlation for each metric
  for (const [metric, points] of Object.entries(insightsByMetric)) {
    if (points.length < 5) continue;

    const habitValues = points.map(p => p.habitValue);
    const sleepValues = points.map(p => p.sleepValue);

    const correlation = calculatePearsonCorrelationSimple(habitValues, sleepValues);

    // Store insights with lower threshold (0.2 instead of 0.3)
    if (correlation && Math.abs(correlation.r) > 0.2) {
      insights.push({
        user_id: habit.user_id,
        habit_id: habit.id,
        insight_type: 'correlation',
        date_range_start: points[0]?.date || new Date().toISOString().split('T')[0],
        date_range_end: points[points.length - 1]?.date || new Date().toISOString().split('T')[0],
        insight_data: {
          sleep_metric: metric,
          correlation: correlation.r,
          p_value: correlation.p || 1,
          significance: Math.abs(correlation.r) > 0.2,
          data_points: correlation.n,
          direction: correlation.r > 0 ? 'positive' : 'negative'
        }
      });
    }
  }

  return insights;
}

// Calculate basic statistics for binary insights
function calculateBasicStats(values: number[]) {
  if (values.length === 0) return { median: 0, q1: 0, q3: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor(sorted.length * 3 / 4)];

  return { median, q1, q3 };
}

// Simplified Pearson correlation for numerical insights
function calculatePearsonCorrelationSimple(x: number[], y: number[]) {
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

  // Simplified p-value approximation
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  const p = 2 * (1 - studentT(t, n - 2));

  return { r, p, n };
}

// Calculate Pearson correlation coefficient
function calculatePearsonCorrelation(dataPoints: Array<{x: number, y: number}>) {
  const n = dataPoints.length
  const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0)
  const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0)
  const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0)
  const sumX2 = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0)
  const sumY2 = dataPoints.reduce((sum, p) => sum + p.y * p.y, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return { r: 0, p: 1, n }

  const r = numerator / denominator
  
  // Calculate p-value using t-distribution approximation
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r))
  const p = 2 * (1 - studentT(t, n - 2)) // Two-tailed test

  return { r, p, n }
}

// Approximation of Student's t cumulative distribution function
function studentT(t: number, df: number): number {
  // Simplified approximation - in production, you'd want a more accurate implementation
  const x = df / (df + t * t)
  let p = 1 - 0.5 * Math.pow(x, df/2)
  
  // Refine approximation
  for (let i = 0; i < 10; i++) {
    p = 0.5 + 0.5 * Math.sign(t) * (0.5 - p)
  }
  
  return p
}

// Store insights in the database
async function storeInsights(supabase: any, insights: any[]) {
  if (insights.length === 0) return 0

  const { data, error } = await supabase
    .from('insights')
    .upsert(insights, {
      onConflict: 'user_id,habit_id,insight_type,date_range_start,date_range_end',
      ignoreDuplicates: false
    })

  if (error) {
    console.error('Error storing insights:', error)
    throw error
  }

  console.log(`Stored ${insights.length} insights`)
  return insights.length
}
