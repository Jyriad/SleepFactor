import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Migrate insights function started")

serve(async (req) => {
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

    // Get ALL users (for migration)
    const { data: users, error: usersError } = await supabaseService
      .from('users')
      .select('id')

    if (usersError) {
      throw new Error(`Failed to get users: ${usersError.message}`)
    }

    console.log(`Found ${users?.length || 0} total users to migrate`)

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users to migrate' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    // Process users in batches to avoid timeouts
    const batchSize = 5 // Smaller batches for migration
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      console.log(`Migrating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}`)

      const batchPromises = batch.map(user => processUserInsights(supabaseService, user.id))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add small delay between batches to be gentle on the database
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const totalProcessed = results.reduce((sum, result) => sum + result.processed, 0)
    const totalErrors = results.reduce((sum, result) => sum + result.errors, 0)

    return new Response(
      JSON.stringify({
        success: true,
        migratedUsers: users.length,
        totalInsights: totalProcessed,
        totalErrors,
        message: `Migrated ${users.length} users, computed ${totalProcessed} insights`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in migrate-insights function:', error)
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

// Import the same functions from compute-insights
async function processUserInsights(supabase: any, userId: string) {
  try {
    console.log(`Processing insights for user ${userId}`)
    
    // Get date range (last 90 days for migration to capture historical data)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 90)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get user data
    const [habits, habitLogs, drugLevels, sleepData] = await Promise.all([
      getActiveHabits(supabase, userId),
      getHabitLogs(supabase, userId, startDateStr, endDateStr),
      getDrugLevels(supabase, userId, startDateStr, endDateStr),
      getSleepData(supabase, userId, startDateStr, endDateStr)
    ])

    console.log(`User ${userId}: ${habits.length} habits, ${habitLogs.length} logs, ${sleepData.length} sleep records`)

    const insights = []

    // Process each habit
    for (const habit of habits) {
      try {
        // Use different data sources based on habit type
        let habitData
        if (habit.type === 'quick_consumption') {
          // For quick_consumption habits, use drug levels
          habitData = drugLevels.filter(dl => dl.habit_id === habit.id)
        } else {
          // For other habit types, use habit logs
          habitData = habitLogs.filter(hl => hl.habit_id === habit.id)
        }

        console.log(`Processing habit ${habit.name} (${habit.type}): ${habitData.length} data points`)

        // Calculate insights for this habit
        const habitInsights = await calculateHabitInsights(habit, habitData, sleepData)
        insights.push(...habitInsights)

      } catch (habitError) {
        console.error(`Error processing habit ${habit.name} for user ${userId}:`, habitError)
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

    // Store insights in database
    const storedCount = await storeInsights(supabase, insights)
    
    return {
      userId,
      processed: storedCount,
      errors: 0
    }

  } catch (error) {
    console.error(`Error processing user ${userId}:`, error)
    return {
      userId,
      processed: 0,
      errors: 1
    }
  }
}

// Copy all the helper functions from compute-insights
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

async function calculateHabitInsights(habit: any, habitData: any[], sleepData: any[]) {
  const insights = []
  
  // Only calculate insights if we have sufficient data
  if (habitData.length < 10) {
    console.log(`Skipping insights for habit ${habit.name} - insufficient data (${habitData.length} points)`)
    return insights
  }

  // Calculate correlation with sleep metrics
  const sleepMetrics = ['total_sleep_minutes', 'deep_sleep_minutes', 'rem_sleep_minutes', 'sleep_score']
  
  for (const metric of sleepMetrics) {
    try {
      const correlation = calculateCorrelation(habitData, sleepData, metric)
      if (correlation && Math.abs(correlation.r) > 0.3) { // Only store significant correlations
        insights.push({
          user_id: habit.user_id,
          habit_id: habit.id,
          insight_type: 'correlation',
          date_range_start: habitData[0]?.date || new Date().toISOString().split('T')[0],
          date_range_end: habitData[habitData.length - 1]?.date || new Date().toISOString().split('T')[0],
          insight_data: {
            sleep_metric: metric,
            correlation: correlation.r,
            p_value: correlation.p,
            significance: Math.abs(correlation.r) > 0.3,
            data_points: correlation.n,
            direction: correlation.r > 0 ? 'positive' : 'negative'
          }
        })
      }
    } catch (corrError) {
      console.error(`Error calculating correlation for ${habit.name} vs ${metric}:`, corrError)
    }
  }

  return insights
}

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

function calculateCorrelation(habitData: any[], sleepData: any[], sleepMetric: string) {
  // Create aligned data points
  const dataPoints = []
  
  habitData.forEach(habit => {
    const sleep = sleepData.find(s => s.date === habit.date)
    if (sleep && sleep[sleepMetric] != null) {
      let habitValue, sleepValue
      
      if (habit.value) {
        // Habit log value
        habitValue = parseFloat(habit.value) || 0
      } else if (habit.level_value != null) {
        // Drug level value
        habitValue = habit.level_value
      } else {
        return // Skip if no valid habit value
      }
      
      sleepValue = sleep[sleepMetric]
      dataPoints.push({ x: habitValue, y: sleepValue })
    }
  })

  if (dataPoints.length < 5) return null // Need minimum data points

  return calculatePearsonCorrelation(dataPoints)
}

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
