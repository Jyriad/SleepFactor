import sleepDataService from './sleepDataService';
import { supabase } from './supabase';

/**
 * Service for calculating and managing bedtime-related habits
 */
class BedtimeHabitsService {

  /**
   * Calculate estimated bedtime from sleep data using the same logic as SleepTimeline
   * @param {Object} sleepRecord - Sleep data record
   * @returns {Date|null} Estimated bedtime, or null if cannot calculate
   */
  calculateEstimatedBedtime(sleepRecord) {
    const {
      deep_sleep_minutes = 0,
      light_sleep_minutes = 0,
      rem_sleep_minutes = 0,
      awake_minutes = 0,
      total_sleep_minutes = 0,
      sleep_start_time, // Try to use actual sleep session start time
      sleep_end_time,   // Try to use actual sleep session end time
    } = sleepRecord;

    const totalTime = total_sleep_minutes + awake_minutes;
    if (totalTime === 0) {
      return null;
    }

    let sleepStart;

    // Use actual sleep session times if available (same as SleepTimeline)
    if (sleep_start_time && sleep_end_time) {
      sleepStart = new Date(sleep_start_time);
    } else {
      // Estimate start time when we don't have exact data (same as SleepTimeline)
      // Calculate backwards from the sleep date to estimate when sleep might have started
      const sleepDate = new Date(sleepRecord.date);
      const sleepEnd = new Date(sleepDate);
      sleepEnd.setHours(8, 0, 0, 0); // Assume wake up at 8 AM

      sleepStart = new Date(sleepEnd);
      sleepStart.setMinutes(sleepStart.getMinutes() - totalTime); // Subtract total sleep time
    }

    return sleepStart;
  }

  /**
   * Normalize bedtime to minutes past midnight, handling after-midnight cases
   * If bedtime is before 6 AM, treat it as late night of previous day
   * @param {Date} bedtime - The bedtime date
   * @returns {number} Minutes past midnight (normalized)
   */
  normalizeBedtimeToMinutes(bedtime) {
    let minutes = bedtime.getHours() * 60 + bedtime.getMinutes();
    
    // If bedtime is before 6 AM, treat as late night of previous day
    // This handles cases like 00:15 (12:15 AM) which should be 1455 minutes (24*60 + 15)
    if (bedtime.getHours() < 6) {
      minutes += 1440; // Add 24 hours
    }
    
    return minutes;
  }

  /**
   * Filter out unrealistic bedtimes using median-based outlier detection
   * @param {number[]} bedtimes - Array of bedtime minutes
   * @returns {number[]} Filtered bedtimes with outliers removed
   */
  filterOutliers(bedtimes) {
    if (bedtimes.length < 3) return bedtimes; // Need at least 3 to detect outliers
    
    // Calculate median for outlier detection (more robust than mean)
    const sorted = [...bedtimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Filter out bedtimes more than 4 hours (240 minutes) from median
    const maxDeviation = 240;
    const filtered = bedtimes.filter(bt => Math.abs(bt - median) <= maxDeviation);
    
    return filtered;
  }

  /**
   * Validate sleep duration is reasonable
   * @param {number} totalSleepMinutes - Total sleep minutes
   * @param {number} awakeMinutes - Awake minutes
   * @returns {boolean} True if duration is valid
   */
  validateSleepDuration(totalSleepMinutes, awakeMinutes) {
    const totalTime = totalSleepMinutes + awakeMinutes;
    
    // Sleep sessions should be between 3 and 16 hours
    if (totalTime < 180 || totalTime > 960) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate bedtime is in reasonable range
   * @param {number} bedtimeMinutes - Bedtime in minutes past midnight
   * @returns {boolean} True if bedtime is valid
   */
  validateBedtime(bedtimeMinutes) {
    // Bedtime should be between 6 PM (1080 minutes) and 6 AM next day (1500 minutes)
    // This covers the range 18:00 to 06:00 next day = 1080 to 1500 minutes
    const minBedtime = 1080; // 6 PM
    const maxBedtime = 1500; // 6 AM next day (1440 + 60)
    
    return bedtimeMinutes >= minBedtime && bedtimeMinutes <= maxBedtime;
  }

  /**
   * Calculate bedtime consistency for a given date
   * Returns the signed deviation in minutes from the average bedtime over the last 5 nights
   * Negative values mean earlier-than-average bedtime, positive means later-than-average
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<number|null>} Signed deviation in minutes, or null if insufficient data
   */
  async calculateBedtimeConsistency(userId, date) {
    try {
      // Get sleep data for the last 6 nights (including current date)
      const targetDate = new Date(date);
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 5); // 5 days back to get 6 nights total

      const startDateString = startDate.toISOString().split('T')[0];
      const endDateString = date;

      const sleepData = await sleepDataService.getSleepDataForRange(startDateString, endDateString, userId);

      if (!sleepData || sleepData.length < 2) {
        return null; // Need at least 2 nights to calculate consistency
      }

      // Calculate estimated bedtimes with validation
      const bedtimeDetails = sleepData
        .map(record => {
          const totalSleep = record.total_sleep_minutes || 0;
          const awakeMinutes = record.awake_minutes || 0;
          
          // Validate sleep duration
          if (!this.validateSleepDuration(totalSleep, awakeMinutes)) {
            return null;
          }
          
          const estimatedBedtime = this.calculateEstimatedBedtime(record);
          if (!estimatedBedtime) return null;
          
          // Normalize bedtime to minutes (handles after-midnight cases)
          const bedtimeMinutes = this.normalizeBedtimeToMinutes(estimatedBedtime);
          const bedtimeTime = `${estimatedBedtime.getHours().toString().padStart(2, '0')}:${estimatedBedtime.getMinutes().toString().padStart(2, '0')}`;
          
          // Validate bedtime is in reasonable range
          if (!this.validateBedtime(bedtimeMinutes)) {
            return null;
          }
          
          return {
            date: record.date,
            bedtime: estimatedBedtime,
            bedtimeMinutes: bedtimeMinutes,
            bedtimeTime: bedtimeTime,
            totalSleep: totalSleep,
            awakeMinutes: awakeMinutes,
            hasSessionTime: !!(record.sleep_start_time && record.sleep_end_time)
          };
        })
        .filter(detail => detail !== null);

      if (bedtimeDetails.length < 2) {
        return null; // Need at least 2 nights to calculate consistency
      }

      // Filter outliers
      const bedtimes = bedtimeDetails.map(d => d.bedtimeMinutes);
      const filteredBedtimes = this.filterOutliers(bedtimes);
      
      if (filteredBedtimes.length < 2) {
        return null;
      }

      // Calculate mean average bedtime
      const averageBedtime = filteredBedtimes.reduce((sum, time) => sum + time, 0) / filteredBedtimes.length;

      // Find the target record
      const targetDetail = bedtimeDetails.find(d => d.date === date);

      if (!targetDetail) {
        return null; // No sleep data for target date
      }

      const targetBedtimeMinutes = targetDetail.bedtimeMinutes;

      // Keep direction so charts can distinguish earlier vs later bedtimes.
      let deviation = targetBedtimeMinutes - averageBedtime;

      // Cap extreme deviations to prevent unrealistic values (max 8 hours inconsistency)
      const maxReasonableDeviation = 480; // 8 hours
      const cappedDeviation = Math.max(-maxReasonableDeviation, Math.min(maxReasonableDeviation, deviation));

      const roundedDeviation = Math.round(cappedDeviation);

      return roundedDeviation;

    } catch (error) {
      return null;
    }
  }

  /**
   * Get the estimated bedtime for a given date (using same logic as SleepTimeline)
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<string|null>} Bedtime in HH:MM format, or null if no data
   */
  async getActualBedtime(userId, date) {
    try {
      const sleepData = await sleepDataService.getSleepDataForDate(date, userId);

      if (!sleepData) {
        return null;
      }

      const estimatedBedtime = this.calculateEstimatedBedtime(sleepData);
      if (!estimatedBedtime) {
        return null;
      }

      const hours = estimatedBedtime.getHours().toString().padStart(2, '0');
      const minutes = estimatedBedtime.getMinutes().toString().padStart(2, '0');

      return `${hours}:${minutes}`;

    } catch (error) {
      return null;
    }
  }

  /**
   * Backfill bedtime habit data for existing sleep records
   * @param {string} userId - User ID
   * @param {number} daysBack - Number of days to backfill (default: 30)
   * @returns {Promise<void>}
   */
  async backfillBedtimeHabits(userId, daysBack = 30) {
    try {
      // Get habit IDs for bedtime habits
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name, is_active')
        .eq('user_id', userId)
        .in('name', ['Bedtime Consistency']);

      if (habitsError) {
        return;
      }

      // Find habits regardless of active state for backfill operations
      // This allows manual syncs to refresh data even if habit is temporarily disabled
      const bedtimeConsistencyHabit = habits?.find(h => h.name === 'Bedtime Consistency');

      if (!bedtimeConsistencyHabit) {
        return;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - daysBack);

      const startDateString = startDate.toISOString().split('T')[0];
      const endDateString = endDate.toISOString().split('T')[0];

      const sleepData = await sleepDataService.getSleepDataForRange(startDateString, endDateString, userId);

      if (!sleepData || sleepData.length === 0) {
        return;
      }

      // Process each sleep record (reuse the logic from updateBedtimeHabitsForSyncedData)
      let totalEntries = 0;
      for (const sleepRecord of sleepData) {
        const date = sleepRecord.date;
        const habitLogEntries = [];

        // Calculate and add bedtime consistency (uses estimated bedtime calculation, same as SleepTimeline)
        if (bedtimeConsistencyHabit) {
          const consistency = await this.calculateBedtimeConsistency(userId, date);
          if (consistency !== null) {
            habitLogEntries.push({
              user_id: userId,
              habit_id: bedtimeConsistencyHabit.id,
              date: date,
              value: consistency.toString(),
              numeric_value: consistency,
            });
          }
        }

        // Upsert habit logs
        if (habitLogEntries.length > 0) {
          const { error: logError } = await supabase
            .from('habit_logs')
            .upsert(habitLogEntries, {
              onConflict: 'user_id,habit_id,date',
            });

          if (logError) {
          } else {
            totalEntries += habitLogEntries.length;
          }
        }
      }

    } catch (error) {
    }
  }

  /**
   * Update bedtime habit logs for newly synced sleep data
   * @param {string} userId - User ID
   * @param {Array} newSleepRecords - Array of newly synced sleep records
   * @returns {Promise<void>}
   */
  async updateBedtimeHabitsForSyncedData(userId, newSleepRecords) {
    try {
      if (!newSleepRecords || newSleepRecords.length === 0) {
        return;
      }

      // Get habit IDs for bedtime habits
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name, is_active')
        .eq('user_id', userId)
        .in('name', ['Bedtime Consistency']);

      if (habitsError) {
        return;
      }


      const bedtimeConsistencyHabit = habits?.find(h => h.name === 'Bedtime Consistency');

      if (!bedtimeConsistencyHabit) {
        return;
      }

      // Process each new sleep record
      for (const sleepRecord of newSleepRecords) {
        const date = sleepRecord.date;

        // Prepare habit log entries
        const habitLogEntries = [];

        // Calculate and add bedtime consistency (uses estimated bedtime calculation, same as SleepTimeline)
        if (bedtimeConsistencyHabit) {
          const consistency = await this.calculateBedtimeConsistency(userId, date);
          if (consistency !== null) {
            habitLogEntries.push({
              user_id: userId,
              habit_id: bedtimeConsistencyHabit.id,
              date: date,
              value: consistency.toString(),
              numeric_value: consistency,
            });
          }
        }

        // Upsert habit logs
        if (habitLogEntries.length > 0) {
          const { error: logError } = await supabase
            .from('habit_logs')
            .upsert(habitLogEntries, {
              onConflict: 'user_id,habit_id,date',
            });

          if (logError) {
          } else {
          }
        }
      }

    } catch (error) {
    }
  }
}

export default new BedtimeHabitsService();
