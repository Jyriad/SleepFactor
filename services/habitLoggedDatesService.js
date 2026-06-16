import { supabase } from './supabase';
import healthMetricsService from './healthMetricsService';
import { INFERRED_HABIT_NAMES } from '../constants/inferredHabits';
import { formatDateForDB } from '../utils/dateHelpers';

const INFERRED_HABIT_NAME_SET = new Set(INFERRED_HABIT_NAMES);

/** Same habit filters as get_home_dashboard_data.logged_dates / get_visible_logged_dates_in_range. */
function habitCountsForStripTick(habit) {
  if (!habit) return false;
  if (habit.name === 'Coffee') return false;
  if (INFERRED_HABIT_NAME_SET.has(habit.name)) return false;
  const isCustom = habit.is_custom === true || habit.is_custom === 'true';
  if (!isCustom && healthMetricsService.isHealthMetricHabit(habit)) return false;
  return true;
}

function consumptionCountsForStripTick(habitType) {
  return habitType === 'quick_consumption' || habitType === 'drug';
}

/**
 * Habit-logged dates for the home/journal week strip — same rules as get_home_dashboard_data.logged_dates.
 */
class HabitLoggedDatesService {
  constructor() {
    this._stripCache = {};
  }

  invalidateStripCache() {
    this._stripCache = {};
  }

  async _fetchLoggedDatesFromClient(userId, startDate, endDate) {
    const loggedSet = new Set();

    const [habitLogsResult, consumptionResult] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('date, habit_id, habits!inner(*)')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('habit_consumption_events')
        .select('consumed_at, habits!inner(type)')
        .eq('user_id', userId)
        .gte('consumed_at', `${startDate}T00:00:00.000Z`)
        .lte('consumed_at', `${endDate}T23:59:59.999Z`),
    ]);

    if (habitLogsResult.error) {
      throw habitLogsResult.error;
    }
    if (consumptionResult.error) {
      throw consumptionResult.error;
    }

    (habitLogsResult.data || []).forEach((log) => {
      if (habitCountsForStripTick(log.habits)) {
        loggedSet.add(typeof log.date === 'string' ? log.date : formatDateForDB(log.date));
      }
    });

    (consumptionResult.data || []).forEach((event) => {
      if (consumptionCountsForStripTick(event.habits?.type)) {
        loggedSet.add(formatDateForDB(new Date(event.consumed_at)));
      }
    });

    return Array.from(loggedSet).sort();
  }

  /**
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @param {{ cacheNonce?: number }} [opts]
   * @returns {Promise<string[]>} YYYY-MM-DD strings
   */
  async fetchVisibleLoggedDatesForStrip(startDate, endDate, opts) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const cacheNonce =
      opts != null && typeof opts === 'object' && typeof opts.cacheNonce === 'number'
        ? opts.cacheNonce
        : 0;

    const cacheKey = `${user.id}:${startDate}:${endDate}:loggedStrip:n${cacheNonce}`;
    if (this._stripCache[cacheKey]) {
      return this._stripCache[cacheKey];
    }

    let dates;

    try {
      const { data, error } = await supabase.rpc('get_visible_logged_dates_in_range', {
        p_user_id: user.id,
        p_start: startDate,
        p_end: endDate,
      });

      if (error) {
        throw error;
      }

      dates = (data || []).map((row) =>
        typeof row === 'string' ? row : formatDateForDB(row)
      );
    } catch (rpcError) {
      console.log(
        '[habitLoggedDatesService] RPC unavailable, using client queries:',
        rpcError?.message || rpcError
      );
      dates = await this._fetchLoggedDatesFromClient(user.id, startDate, endDate);
    }

    this._stripCache[cacheKey] = dates;
    return dates;
  }
}

export default new HabitLoggedDatesService();
