import { supabase } from './supabase';
import {
  getBedtimeDrugLevel,
  getCurrentDrugLevel,
  calculateTotalDrugLevel,
  decayLevelToTime,
  generateDrugLevelTimeline,
} from '../utils/drugHalfLife';

const DEFAULT_HALF_LIFE_HOURS = 5;
const THRESHOLD_PERCENT = 5;

/**
 * Get current drug level using last stored bedtime level (decayed to now) + today's consumption.
 * Falls back to full event-based calculation when no previous drug_levels row or no bedtime_at.
 * @param {string} userId - User ID
 * @param {Object} habit - Habit with id, name, unit, half_life_hours
 * @returns {Promise<{ level: number, unit: string }>}
 */
export async function getLevelNow(userId, habit) {
  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const unit = habit?.unit || 'units';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  // Fetch most recent drug_levels row for this habit (before or equal to today)
  const todayStr = now.toISOString().split('T')[0];
  const { data: lastLevelRows, error: levelError } = await supabase
    .from('drug_levels')
    .select('level_value, bedtime_at, date')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .lte('date', todayStr)
    .order('date', { ascending: false })
    .limit(1);

  if (levelError || !lastLevelRows || lastLevelRows.length === 0) {
    return fallbackLevelFromEvents(userId, habit, halfLife, unit);
  }

  const last = lastLevelRows[0];
  const bedtimeAt = last.bedtime_at ? new Date(last.bedtime_at) : null;

  // If no bedtime_at, fall back to full event calculation
  if (!bedtimeAt || bedtimeAt > now) {
    return fallbackLevelFromEvents(userId, habit, halfLife, unit);
  }

  // Carryover: decay last bedtime level to now
  const carryover = decayLevelToTime(
    Number(last.level_value),
    bedtimeAt,
    now,
    halfLife
  );

  // Today's events from midnight to now
  const { data: todayEvents, error: eventsError } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', todayStart.toISOString())
    .lte('consumed_at', now.toISOString())
    .order('consumed_at', { ascending: true });

  if (eventsError) {
    return { level: carryover, unit };
  }

  const fromToday = (todayEvents && todayEvents.length > 0)
    ? calculateTotalDrugLevel(todayEvents, now, halfLife, THRESHOLD_PERCENT)
    : 0;

  const level = carryover + fromToday;
  return { level, unit };
}

/**
 * Fallback: fetch events from past N days and compute current level from events only.
 */
async function fallbackLevelFromEvents(userId, habit, halfLife, unit) {
  const now = new Date();
  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - historyDays);

  const { data: events, error } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', historyStart.toISOString())
    .lte('consumed_at', now.toISOString())
    .order('consumed_at', { ascending: true });

  if (error || !events || events.length === 0) {
    return { level: 0, unit };
  }

  const level = getCurrentDrugLevel(events, halfLife, THRESHOLD_PERCENT);
  return { level, unit };
}

/**
 * Get timeline data for "level over today" for the line chart.
 * Uses the same logic as getLevelNow: carryover from last stored bedtime (decayed to each time)
 * plus level from consumption events. This keeps the graph in sync with the "level right now" number.
 * @param {string} userId - User ID
 * @param {Object} habit - Habit with id, half_life_hours, unit
 * @returns {Promise<{ dataPoints: Array<{ time: Date, level: number }>, unit: string }>}
 */
export async function getLevelTimelineForToday(userId, habit) {
  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const unit = habit?.unit || 'units';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Fetch most recent drug_levels row (same as getLevelNow) for carryover
  const { data: lastLevelRows, error: levelError } = await supabase
    .from('drug_levels')
    .select('level_value, bedtime_at')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .lte('date', todayStr)
    .order('date', { ascending: false })
    .limit(1);

  let carryoverLevel = 0;
  let carryoverBedtimeAt = null;
  if (!levelError && lastLevelRows?.length > 0) {
    const last = lastLevelRows[0];
    const bedtimeAt = last.bedtime_at ? new Date(last.bedtime_at) : null;
    if (bedtimeAt && bedtimeAt <= now) {
      carryoverLevel = Number(last.level_value);
      carryoverBedtimeAt = bedtimeAt;
    }
  }

  // Events that can affect today: from (todayStart - historyDays) through now
  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const fetchStart = new Date(todayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  const { data: events, error } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', fetchStart.toISOString())
    .lte('consumed_at', now.toISOString())
    .order('consumed_at', { ascending: true });

  if (error) {
    return { dataPoints: [], unit };
  }

  const eventList = events || [];
  // When we have carryover from last bedtime, only add level from events after that time;
  // otherwise we double-count (carryover already includes decay from earlier events).
  const eventsForIncrement = carryoverBedtimeAt
    ? eventList.filter((e) => new Date(e.consumed_at) > carryoverBedtimeAt)
    : eventList;
  const intervalMinutes = 30;
  const intervalMs = intervalMinutes * 60 * 1000;
  const dataPoints = [];
  let currentTime = new Date(todayStart);

  while (currentTime <= todayEnd) {
    let carryoverAtTime = 0;
    if (carryoverBedtimeAt && currentTime >= carryoverBedtimeAt) {
      carryoverAtTime = decayLevelToTime(
        carryoverLevel,
        carryoverBedtimeAt,
        currentTime,
        halfLife
      );
    }
    const eventLevelAtTime = calculateTotalDrugLevel(
      eventsForIncrement,
      currentTime,
      halfLife,
      THRESHOLD_PERCENT
    );
    dataPoints.push({
      time: new Date(currentTime),
      level: carryoverAtTime + eventLevelAtTime,
    });
    currentTime = new Date(currentTime.getTime() + intervalMs);
  }

  return { dataPoints, unit };
}

/**
 * Get timeline data for "level over [date]" for the line chart (any date, not just today).
 * @param {string} userId - User ID
 * @param {Object} habit - Habit with id, half_life_hours, unit
 * @param {string} dateStr - Date in YYYY-MM-DD
 * @returns {Promise<{ dataPoints: Array<{ time: Date, level: number }>, unit: string }>}
 */
export async function getLevelTimelineForDate(userId, habit, dateStr) {
  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const unit = habit?.unit || 'units';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0);

  console.log('[drugLevelService] getLevelTimelineForDate called', { dateStr, dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() });

  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const fetchStart = new Date(dayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  const { data: events, error } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', fetchStart.toISOString())
    .lte('consumed_at', dayEnd.toISOString())
    .order('consumed_at', { ascending: true });

  if (error) {
    console.log('[drugLevelService] getLevelTimelineForDate error', { dateStr, error: error.message });
    return { dataPoints: [], unit };
  }

  const dataPoints = generateDrugLevelTimeline(
    events || [],
    dayStart,
    dayEnd,
    halfLife,
    THRESHOLD_PERCENT,
    30
  );

  const firstTime = dataPoints?.[0]?.time;
  const lastTime = dataPoints?.length ? dataPoints[dataPoints.length - 1]?.time : null;
  console.log('[drugLevelService] getLevelTimelineForDate result', { dateStr, eventCount: (events || []).length, dataPointCount: (dataPoints || []).length, firstTime: firstTime?.toISOString?.(), lastTime: lastTime?.toISOString?.() });

  return { dataPoints, unit };
}

/**
 * Get level at bedtime for a specific date (from drug_levels, same value used for insight analysis).
 * @param {string} userId - User ID
 * @param {Object} habit - Habit with id, unit
 * @param {string} dateStr - Date in YYYY-MM-DD
 * @returns {Promise<{ level: number, unit: string }>}
 */
export async function getLevelAtBedtime(userId, habit, dateStr) {
  const unit = habit?.unit || 'units';
  const { data, error } = await supabase
    .from('drug_levels')
    .select('level_value, unit')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .eq('date', dateStr)
    .maybeSingle();
  if (error || !data) {
    return { level: 0, unit };
  }
  return {
    level: Number(data.level_value) || 0,
    unit: data.unit || unit,
  };
}

export default {
  getLevelNow,
  getLevelTimelineForToday,
  getLevelTimelineForDate,
  getLevelAtBedtime,
};
