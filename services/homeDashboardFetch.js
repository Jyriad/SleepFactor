import { supabase } from './supabase';
import homeCacheService from './homeCacheService';
import { setHabitLoggingState as setHabitLoggingCache, setInMemoryState as setHabitLoggingMemory } from './habitLoggingCacheService';
import consumptionOptionsService from './consumptionOptionsService';
import drugLevelService from './drugLevelService';
import { formatDateForDB } from '../utils/dateHelpers';

const DASHBOARD_RPC_TIMEOUT_MS = 10000;
const MAX_STARTUP_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 450;

export function isValidDashboardPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.error) return false;
  if (!Object.prototype.hasOwnProperty.call(payload, 'sleep_record')) return false;
  if (!payload.habit_counts || typeof payload.habit_counts !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(payload.habit_counts, 'logged_count')) return false;
  if (!Object.prototype.hasOwnProperty.call(payload.habit_counts, 'total_active_count')) return false;
  if (!Object.prototype.hasOwnProperty.call(payload, 'habits_logged')) return false;
  if (!Object.prototype.hasOwnProperty.call(payload, 'todays_habits_logged')) return false;
  return true;
}

function prefetchHabitLoggingSideData(userId) {
  if (!userId) return;
  (async () => {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayStr = formatDateForDB(today);
      const yesterdayStr = formatDateForDB(yesterday);
      const [resToday, resYesterday] = await Promise.all([
        supabase.rpc('get_habit_logging_state', { p_user_id: userId, p_date: todayStr }),
        supabase.rpc('get_habit_logging_state', { p_user_id: userId, p_date: yesterdayStr }),
      ]);
      if (resToday?.data && !resToday?.error) {
        await setHabitLoggingCache(userId, todayStr, resToday.data);
        setHabitLoggingMemory(userId, todayStr, resToday.data);
        const consumptionHabits = (resToday.data.habits || []).filter(
          (h) => h.type === 'drug' || h.type === 'quick_consumption'
        );
        consumptionHabits.forEach((h) => consumptionOptionsService.getOptionsForHabit(h.id).catch(() => {}));
        consumptionHabits.forEach((h) => drugLevelService.getLevelNow(userId, h).catch(() => {}));
      }
      if (resYesterday?.data && !resYesterday?.error) {
        await setHabitLoggingCache(userId, yesterdayStr, resYesterday.data);
        setHabitLoggingMemory(userId, yesterdayStr, resYesterday.data);
      }
    } catch (_e) {}
  })();
}

async function rpcDashboard(userId, dateStr) {
  let timeoutId = null;
  const rpcPromise = supabase.rpc('get_home_dashboard_data', {
    p_user_id: userId,
    p_date: dateStr,
  });
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('dashboard_rpc_timeout')), DASHBOARD_RPC_TIMEOUT_MS);
  });
  const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);
  if (error) throw error;
  if (data?.error) {
    const err = new Error(String(data.error));
    err.isAuthWarmup = String(data.error).toLowerCase().includes('unauthorized');
    throw err;
  }
  if (!isValidDashboardPayload(data)) {
    throw new Error('invalid_dashboard_payload');
  }
  return data;
}

/**
 * Fetch home dashboard payload for a date (with today+yesterday sleep merge when needed).
 */
export async function fetchHomeDashboardPayload({
  userId,
  dateStr,
  getToday,
  getYesterday,
  retryAttempt = 0,
}) {
  prefetchHabitLoggingSideData(userId);

  try {
    let dashboardPayload = await rpcDashboard(userId, dateStr);

    if (dateStr === getToday()) {
      const hasSleep =
        dashboardPayload.sleep_record &&
        typeof dashboardPayload.sleep_record === 'object' &&
        dashboardPayload.sleep_record.id != null;
      if (!hasSleep) {
        const yStr = getYesterday();
        try {
          const yData = await rpcDashboard(userId, yStr);
          const ySleep =
            yData.sleep_record &&
            typeof yData.sleep_record === 'object' &&
            yData.sleep_record.id != null
              ? yData.sleep_record
              : null;
          if (ySleep) {
            dashboardPayload = { ...dashboardPayload, sleep_record: ySleep };
          }
        } catch (_mergeErr) {
          /* optional */
        }
      }
    }

    await homeCacheService.setPersistedDashboardPayload(userId, dateStr, dashboardPayload);
    homeCacheService.setLastAppliedDashboardPayload(userId, dateStr, dashboardPayload);
    return dashboardPayload;
  } catch (err) {
    const message = String(err?.message || '');
    const isLikelyAuthWarmup =
      err?.isAuthWarmup || /unauthorized|jwt|auth session missing|invalid jwt/i.test(message);
    if (isLikelyAuthWarmup && retryAttempt < MAX_STARTUP_RETRIES) {
      const retryDelay = RETRY_BASE_DELAY_MS * (retryAttempt + 1);
      await new Promise((r) => setTimeout(r, retryDelay));
      return fetchHomeDashboardPayload({
        userId,
        dateStr,
        getToday,
        getYesterday,
        retryAttempt: retryAttempt + 1,
      });
    }
    throw err;
  }
}

export default fetchHomeDashboardPayload;
