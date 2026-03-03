import { supabase } from './supabase';
import healthService from './healthService';
import sleepDataService from './sleepDataService';

const HABIT_NAME = 'Exercise Time Before Bed';

/**
 * Build a map of activity day (YYYY-MM-DD) -> bedtime (Date) from sleep records.
 * Sleep record with date X (wake date) has sleep_start_time on the previous calendar day.
 * So activity day = calendar day of sleep_start_time.
 */
function buildBedtimeByActivityDay(sleepRecords) {
  const map = {};
  if (!sleepRecords || !Array.isArray(sleepRecords)) return map;
  sleepRecords.forEach(record => {
    const st = record.sleep_start_time;
    if (!st) return;
    const d = new Date(st);
    const activityDay = d.toISOString().split('T')[0];
    map[activityDay] = d;
  });
  return map;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate minutes between timeOfMax and bedtime (positive = max HR was before bedtime).
 * @param {string} timeOfMax - ISO string
 * @param {Date} bedtime - Date
 * @returns {number|null} Minutes before bedtime, or null if invalid
 */
function minutesBeforeBed(timeOfMax, bedtime) {
  const t = new Date(timeOfMax);
  if (Number.isNaN(t.getTime()) || Number.isNaN(bedtime.getTime())) return null;
  const diffMs = bedtime.getTime() - t.getTime();
  const minutes = Math.round(diffMs / (60 * 1000));
  if (minutes < 0) return null;
  return minutes;
}

/**
 * Service for the inferred habit "Exercise Time Before Bed":
 * uses time of max heart rate each day and that night's bedtime to compute
 * "how many minutes before bed" the peak activity occurred.
 */
class ExerciseTimeBeforeBedService {
  /**
   * Backfill habit logs for the inferred "Exercise Time Before Bed" habit.
   * Requires: heart rate read permission, sleep data with sleep_start_time.
   * @param {string} userId - User ID
   * @param {number} daysBack - Number of days to backfill (default 30)
   * @returns {Promise<{ success: boolean, synced?: number, message?: string }>}
   */
  async backfill(userId, daysBack = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const habitRow = await this._getHabit(userId);
      if (!habitRow) {
        return { success: false, message: 'Exercise Time Before Bed habit not found.' };
      }

      const initialized = await healthService.initialize();
      if (!initialized || !(await healthService.hasPermissions())) {
        return { success: false, message: 'Health permissions are required to calculate exercise time before bed.' };
      }

      const timeOfMaxPerDay = await healthService.getTimeOfMaxHeartRatePerDay(startStr, endStr);
      if (!timeOfMaxPerDay || timeOfMaxPerDay.length === 0) {
        return { success: true, synced: 0, message: 'No heart rate data found for the selected period.' };
      }

      const sleepStartStr = addDays(startStr, 1);
      const sleepEndStr = addDays(endStr, 1);
      const sleepData = await sleepDataService.getSleepDataForRange(sleepStartStr, sleepEndStr);
      const bedtimeByActivityDay = buildBedtimeByActivityDay(sleepData);

      let synced = 0;
      for (const { date, timeOfMax } of timeOfMaxPerDay) {
        const bedtime = bedtimeByActivityDay[date];
        if (!bedtime) continue;
        const mins = minutesBeforeBed(timeOfMax, bedtime);
        if (mins === null) continue;

        const { error } = await supabase
          .from('habit_logs')
          .upsert(
            {
              user_id: userId,
              habit_id: habitRow.id,
              date: date,
              value: String(mins),
              numeric_value: mins,
            },
            { onConflict: 'user_id,habit_id,date' }
          );
        if (!error) synced += 1;
      }

      return { success: true, synced, message: `Synced ${synced} days of exercise time before bed.` };
    } catch (error) {
      return { success: false, message: error?.message || 'Backfill failed.' };
    }
  }

  async _getHabit(userId) {
    const { data, error } = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('name', HABIT_NAME)
      .limit(1)
      .single();
    if (error || !data) return null;
    return data;
  }
}

export default new ExerciseTimeBeforeBedService();
