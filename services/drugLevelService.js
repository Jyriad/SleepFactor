import { supabase } from './supabase';
import sleepDataService from './sleepDataService';
import offlineWriteQueueService from './offlineWriteQueueService';
import { formatDateForDB } from '../utils/dateHelpers';
import {
  getBedtimeDrugLevel,
  calculateTotalDrugLevel,
  generateDrugLevelTimeline,
  habitUsesCaffeineMgFloor,
  applyCaffeineMgFloor,
  CAFFEINE_MG_FLOOR,
} from '../utils/drugHalfLife';

const DEFAULT_HALF_LIFE_HOURS = 5;
const THRESHOLD_PERCENT = 5;

function caffeineAbsoluteMinMg(habit) {
  return habitUsesCaffeineMgFloor(habit) ? CAFFEINE_MG_FLOOR : null;
}

/** Resolve bedtime Date for sleep following dateStr (same rules as getLevelAtBedtime). */
export async function resolveBedtimeForDate(userId, dateStr) {
  try {
    const [y, mo, day] = dateStr.split('-').map(Number);
    const nextDay = new Date(y, mo - 1, day + 1);
    const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    const sleepData = await sleepDataService.getSleepDataForDate(nextDayStr);
    if (sleepData?.sleep_start_time) {
      return new Date(sleepData.sleep_start_time);
    }
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('notification_time')
      .eq('id', userId)
      .single();
    const notificationTime = userError || !userData ? '22:00:00' : (userData.notification_time || '22:00:00');
    const [h, m, s] = notificationTime.split(':').map(Number);
    return new Date(y, mo - 1, day, h, m, s || 0, 0);
  } catch (e) {
    return null;
  }
}
const LEVEL_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes – so prefetch from Home is still valid when opening Habit Logging

const _levelNowCache = new Map(); // key: `${userId}:${habitId}` -> { result, timestamp }

function levelNowCacheKey(userId, habitId) {
  return `${userId}:${habitId}`;
}

function getCachedLevelNow(userId, habitId) {
  const key = levelNowCacheKey(userId, habitId);
  const entry = _levelNowCache.get(key);
  if (!entry || Date.now() - entry.timestamp > LEVEL_CACHE_TTL_MS) {
    if (entry) _levelNowCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedLevelNow(userId, habitId, result) {
  _levelNowCache.set(levelNowCacheKey(userId, habitId), { result, timestamp: Date.now() });
}

/**
 * Call after adding/editing/deleting a consumption event so the next getLevelNow() fetches fresh data.
 * Without this, "level right now" can stay stale while the graph updates (graph is not cached).
 */
export function invalidateLevelNowCache(userId, habitId) {
  if (userId && habitId) _levelNowCache.delete(levelNowCacheKey(userId, habitId));
}

function pendingRowToLevelEvent(queueItemId, row) {
  return {
    id: `pending_${queueItemId}`,
    habit_id: row.habit_id,
    user_id: row.user_id,
    consumed_at: row.consumed_at,
    amount: row.amount,
    drink_type: row.drink_type,
    volume: row.volume,
    logged_intake_basis: row.logged_intake_basis,
    logged_volume_ml: row.logged_volume_ml,
    logged_serving_count: row.logged_serving_count,
  };
}

function mergeConsumptionEventsForLevel(serverEvents, pendingItems, userId, habitId) {
  const byId = new Map();
  (serverEvents || []).forEach((e) => {
    if (e?.habit_id === habitId && e?.user_id === userId) byId.set(e.id, e);
  });
  (pendingItems || []).forEach(({ queueItemId, row }) => {
    if (!row || row.habit_id !== habitId || row.user_id !== userId) return;
    byId.set(`pending_${queueItemId}`, pendingRowToLevelEvent(queueItemId, row));
  });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.consumed_at).getTime() - new Date(b.consumed_at).getTime()
  );
}

function levelFromEvents(events, habit, atTime) {
  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const unit = habit?.unit || 'units';
  const minMg = caffeineAbsoluteMinMg(habit);
  if (!events?.length) return { level: 0, unit };
  let level = calculateTotalDrugLevel(events, atTime, halfLife, THRESHOLD_PERCENT, minMg);
  if (minMg != null) level = applyCaffeineMgFloor(level);
  return { level, unit };
}

/**
 * Same event window and formula as getLevelTimelineForDate for local calendar "today".
 * Purely event-based: decay from all prior consumption in the lookback window (no drug_levels carryover),
 * so "level right now" matches the line chart exactly.
 */
export async function getLevelNow(userId, habit) {
  const pendingItems = await offlineWriteQueueService.getPendingConsumptionCreates();
  const hasPendingForHabit = pendingItems.some((p) => p.row?.habit_id === habit?.id);

  if (!hasPendingForHabit) {
    const cached = getCachedLevelNow(userId, habit?.id);
    if (cached != null) {
      return cached;
    }
  }

  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const fetchStart = new Date(dayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  let serverEvents = [];
  try {
    const { data: events, error } = await supabase
      .from('habit_consumption_events')
      .select('*')
      .eq('user_id', userId)
      .eq('habit_id', habit.id)
      .gte('consumed_at', fetchStart.toISOString())
      .lte('consumed_at', now.toISOString())
      .order('consumed_at', { ascending: true });
    if (!error && events) serverEvents = events;
  } catch (_) {
    serverEvents = [];
  }

  const merged = mergeConsumptionEventsForLevel(serverEvents, pendingItems, userId, habit.id);
  const result = levelFromEvents(merged, habit, now);

  if (merged.length > 0) {
    setCachedLevelNow(userId, habit.id, result);
  }

  return result;
}

/**
 * Get timeline data for "level over today" for the line chart.
 * Delegates to the same path as any other calendar day so the curve matches the readout.
 */
export async function getLevelTimelineForToday(userId, habit) {
  return getLevelTimelineForDate(userId, habit, formatDateForDB(new Date()));
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
  const minMg = caffeineAbsoluteMinMg(habit);
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0);


  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const fetchStart = new Date(dayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  let serverEvents = [];
  try {
    const { data: events, error } = await supabase
      .from('habit_consumption_events')
      .select('*')
      .eq('user_id', userId)
      .eq('habit_id', habit.id)
      .gte('consumed_at', fetchStart.toISOString())
      .lte('consumed_at', dayEnd.toISOString())
      .order('consumed_at', { ascending: true });
    if (!error && events) serverEvents = events;
  } catch (_) {
    serverEvents = [];
  }

  const todayStr = formatDateForDB(new Date());
  const pendingItems =
    dateStr === todayStr ? await offlineWriteQueueService.getPendingConsumptionCreates() : [];
  const merged = mergeConsumptionEventsForLevel(serverEvents, pendingItems, userId, habit.id);

  const dataPoints = generateDrugLevelTimeline(
    merged,
    dayStart,
    dayEnd,
    halfLife,
    THRESHOLD_PERCENT,
    30,
    minMg
  );

  return { dataPoints, unit };
}

/**
 * Get level at bedtime for a specific date. Recalculates from consumption events so past dates
 * always show the correct value (avoids stale/wrong drug_levels from the old bedtime bug).
 * @param {string} userId - User ID
 * @param {Object} habit - Habit with id, unit, half_life_hours
 * @param {string} dateStr - Date in YYYY-MM-DD
 * @returns {Promise<{ level: number, unit: string }>}
 */
export async function getLevelAtBedtime(userId, habit, dateStr) {
  const unit = habit?.unit || 'units';
  const halfLife = habit?.half_life_hours != null ? Number(habit.half_life_hours) : DEFAULT_HALF_LIFE_HOURS;
  const minMg = caffeineAbsoluteMinMg(habit);

  const targetBedtime = await resolveBedtimeForDate(userId, dateStr);
  if (!targetBedtime) {
    return { level: 0, unit, bedtimeAt: null };
  }

  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const fetchStart = new Date(dayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  const { data: events, error } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', fetchStart.toISOString())
    .lte('consumed_at', targetBedtime.toISOString())
    .order('consumed_at', { ascending: true });

  if (error) {
    return { level: 0, unit, bedtimeAt: targetBedtime };
  }

  let level = events?.length > 0
    ? getBedtimeDrugLevel(events, targetBedtime, halfLife, THRESHOLD_PERCENT, minMg)
    : 0;
  if (minMg != null) level = applyCaffeineMgFloor(level);

  return { level, unit, bedtimeAt: targetBedtime };
}

/** Level at current time from in-memory consumption events (includes pending sync). */
export function computeLevelNowFromEvents(events, habit) {
  return levelFromEvents(events, habit, new Date());
}

export default {
  getLevelNow,
  getLevelTimelineForToday,
  getLevelTimelineForDate,
  getLevelAtBedtime,
  invalidateLevelNowCache,
  resolveBedtimeForDate,
  computeLevelNowFromEvents,
};
