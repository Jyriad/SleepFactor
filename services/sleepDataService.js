import { supabase } from './supabase';
import { formatDateForDB } from '../utils/dateHelpers';
import {
  getPreferredSleepSource,
  allowedSleepDataSources,
} from './preferredSleepSourceService';

function scheduleInsightsPersistenceInvalidate() {
  import('./insightsService')
    .then((mod) => {
      mod.default.notifyInsightsUnderlyingDataChanged();
    })
    .catch(() => {});
}

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const c = Math.round(n);
  return c >= 1 && c <= 10 ? c : null;
}

/**
 * Sleep data service for Supabase operations
 */
class SleepDataService {
  constructor() {
    this.tableName = 'sleep_data';
    /** In-memory cache for getSleepDataForRange: key `${userId}:${start}-${end}` -> { data } */
    this._rangeCache = {};
    /** Cached visible wake dates for week strip (RPC matches dashboard rules) */
    this._stripVisibilityCache = {};
  }

  _clearRangeCache() {
    this._rangeCache = {};
  }

  /** Public: invalidate cached reads after preference or sleep writes */
  clearReadCache() {
    this._clearRangeCache();
    this._stripVisibilityCache = {};
  }

  async _applyPreferredSourceFilter(query, userId) {
    const pref = await getPreferredSleepSource(userId);
    const allowed = allowedSleepDataSources(pref);
    if (!allowed) return query;
    return query.in('source', allowed);
  }

  async _cacheSegmentForUser(userId) {
    const pref = await getPreferredSleepSource(userId);
    return pref ?? 'legacy';
  }

  /**
   * Dates in range that already have an upsert from a specific sleep_data.source (for incremental sync).
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @param {string} source - healthkit | health_connect | manual
   * @returns {Promise<Set<string>>}
   */
  async getDatesWithSourceInRange(startDate, endDate, source) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    const { data, error } = await supabase
      .from(this.tableName)
      .select('date')
      .eq('user_id', user.id)
      .eq('source', source)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      throw error;
    }

    return new Set((data || []).map((r) => r.date));
  }

  /**
   * Upsert sleep data (insert or update if exists)
   * @param {Object} sleepData - Sleep data object
   * @param {string} sleepData.date - Date in YYYY-MM-DD format
   * @param {number} sleepData.total_sleep_minutes - Total sleep time in minutes
   * @param {number} sleepData.deep_sleep_minutes - Deep sleep time in minutes
   * @param {number} sleepData.light_sleep_minutes - Light sleep time in minutes
   * @param {number} sleepData.rem_sleep_minutes - REM sleep time in minutes
   * @param {number} sleepData.awake_minutes - Awake time in minutes
   * @param {number} sleepData.awakenings_count - Number of awakenings
   * @param {number|null} sleepData.sleep_score - Sleep score (0-100) or null
   * @param {string} sleepData.source - Data source ('health_connect', 'healthkit', or 'manual')
   * @returns {Promise<Object>} The upserted record
   */
  _buildSleepRecord(userId, sleepData) {
    const record = {
      user_id: userId,
      date: sleepData.date,
      total_sleep_minutes: sleepData.total_sleep_minutes || 0,
      deep_sleep_minutes: sleepData.deep_sleep_minutes || 0,
      light_sleep_minutes: sleepData.light_sleep_minutes || 0,
      rem_sleep_minutes: sleepData.rem_sleep_minutes || 0,
      awake_minutes: sleepData.awake_minutes || 0,
      awakenings_count: sleepData.awakenings_count || 0,
      sleep_score: sleepData.sleep_score,
      source: sleepData.source,
      updated_at: new Date().toISOString(),
    };

    if (sleepData.sleep_start_time) record.sleep_start_time = sleepData.sleep_start_time;
    if (sleepData.sleep_end_time) record.sleep_end_time = sleepData.sleep_end_time;

    if (
      sleepData.sleep_stages !== undefined &&
      sleepData.sleep_stages !== null &&
      Array.isArray(sleepData.sleep_stages) &&
      sleepData.sleep_stages.length > 0
    ) {
      const validStages = sleepData.sleep_stages
        .filter((stage) => stage && stage.stage && stage.startTime && stage.endTime)
        .map((stage) => ({
          stage: stage.stage.trim(),
          startTime: stage.startTime,
          endTime: stage.endTime,
          durationMinutes: stage.durationMinutes || 0,
        }));

      if (validStages.length > 0) {
        record.sleep_stages = validStages;
      }
    }

    if (
      sleepData.sleep_sessions !== undefined &&
      sleepData.sleep_sessions !== null &&
      Array.isArray(sleepData.sleep_sessions) &&
      sleepData.sleep_sessions.length > 0
    ) {
      record.sleep_sessions = sleepData.sleep_sessions;
    }

    return record;
  }

  async upsertSleepData(sleepData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const record = this._buildSleepRecord(user.id, sleepData);
      let { data, error } = await supabase
        .from(this.tableName)
        .upsert(record, {
          onConflict: 'user_id,date',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error && (
        (error.message?.includes('column') && error.message?.includes('does not exist')) ||
        error.message?.includes('sleep_stages') ||
        error.message?.includes('sleep_sessions') ||
        error.code === '42703'
      )) {
        const { sleep_stages, sleep_sessions, ...recordWithoutOptional } = record;
        const retryResult = await supabase
          .from(this.tableName)
          .upsert(recordWithoutOptional, {
            onConflict: 'user_id,date',
            ignoreDuplicates: false,
          })
          .select()
          .single();

        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw error;
      }

      this._clearRangeCache();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch upsert sleep rows (one round-trip per chunk).
   * @param {Array<Object>} sleepRows - Transformed sleep records from health sync
   * @param {number} chunkSize - Max rows per Supabase upsert
   * @returns {Promise<Array<Object>>} Upserted rows
   */
  async upsertSleepDataBatch(sleepRows, chunkSize = 25) {
    if (!sleepRows?.length) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const records = sleepRows
      .filter(Boolean)
      .map((row) => this._buildSleepRecord(user.id, row));

    const saved = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      let { data, error } = await supabase
        .from(this.tableName)
        .upsert(chunk, { onConflict: 'user_id,date', ignoreDuplicates: false })
        .select();

      if (error && (
        (error.message?.includes('column') && error.message?.includes('does not exist')) ||
        error.message?.includes('sleep_stages') ||
        error.message?.includes('sleep_sessions') ||
        error.code === '42703'
      )) {
        const slimChunk = chunk.map(({ sleep_stages, sleep_sessions, ...rest }) => rest);
        const retryResult = await supabase
          .from(this.tableName)
          .upsert(slimChunk, { onConflict: 'user_id,date', ignoreDuplicates: false })
          .select();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw error;
      }
      if (data?.length) {
        saved.push(...data);
      }
    }

    if (saved.length > 0) {
      this._clearRangeCache();
    }
    return saved;
  }

  /**
   * Update or create subjective scores for a sleep date. Does not overwrite existing sync data.
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format (sleep date = morning after that night)
   * @param {Object} scores - { tiredness_score?: number|null, dream_vividness_score?: number|null, customByMeasureId?: Record<string, number|null> }
   *   Built-ins use sleep_data columns; custom measures use subjective_score_entries (1–10 each; null = clear).
   * @returns {Promise<Object|null>} The updated sleep_data row when touched, or null if only custom scores were written
   */
  async updateSubjectiveScores(userId, date, scores) {
    const hasTirednessKey = Object.prototype.hasOwnProperty.call(scores, 'tiredness_score');
    const hasDreamKey = Object.prototype.hasOwnProperty.call(scores, 'dream_vividness_score');
    const tiredness = hasTirednessKey
      ? (scores.tiredness_score != null ? clampScore(scores.tiredness_score) : null)
      : undefined;
    const dreamVividness = hasDreamKey
      ? (scores.dream_vividness_score != null ? clampScore(scores.dream_vividness_score) : null)
      : undefined;

    const customByMeasureId =
      scores.customByMeasureId && typeof scores.customByMeasureId === 'object' ? scores.customByMeasureId : null;

    if (customByMeasureId) {
      const nowIso = new Date().toISOString();
      for (const [measureId, raw] of Object.entries(customByMeasureId)) {
        if (!measureId) continue;
        if (raw == null) {
          const { error: delErr } = await supabase
            .from('subjective_score_entries')
            .delete()
            .eq('user_id', userId)
            .eq('sleep_date', date)
            .eq('measure_id', measureId);
          if (delErr) throw delErr;
        } else {
          const s = clampScore(raw);
          if (s == null) continue;
          const { error: upErr } = await supabase.from('subjective_score_entries').upsert(
            {
              user_id: userId,
              sleep_date: date,
              measure_id: measureId,
              score: s,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,sleep_date,measure_id' }
          );
          if (upErr) throw upErr;
        }
      }
    }

    const touchesBuiltIns = hasTirednessKey || hasDreamKey;
    if (!touchesBuiltIns) {
      this._clearRangeCache();
      if (customByMeasureId && Object.keys(customByMeasureId).length > 0) {
        scheduleInsightsPersistenceInvalidate();
      }
      return null;
    }

    const existing = await supabase
      .from(this.tableName)
      .select('id, user_id, date, source')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (existing.error) throw existing.error;

    const payload = { updated_at: new Date().toISOString() };
    if (hasTirednessKey) payload.tiredness_score = tiredness;
    if (hasDreamKey) payload.dream_vividness_score = dreamVividness;

    if (existing.data) {
      const { data, error } = await supabase
        .from(this.tableName)
        .update(payload)
        .eq('user_id', userId)
        .eq('date', date)
        .select()
        .single();
      if (error) throw error;
      this._clearRangeCache();
      scheduleInsightsPersistenceInvalidate();
      return data;
    }

    const t = hasTirednessKey ? tiredness : null;
    const d = hasDreamKey ? dreamVividness : null;
    if (t === null && d === null) {
      this._clearRangeCache();
      return null;
    }

    const insertRecord = {
      user_id: userId,
      date,
      source: 'manual',
      tiredness_score: t,
      dream_vividness_score: d,
      updated_at: payload.updated_at,
      total_sleep_minutes: null,
      deep_sleep_minutes: null,
      light_sleep_minutes: null,
      rem_sleep_minutes: null,
      awake_minutes: null,
      awakenings_count: 0,
    };
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(insertRecord)
      .select()
      .single();
    if (error) throw error;
    this._clearRangeCache();
    scheduleInsightsPersistenceInvalidate();
    return data;
  }

  /**
   * Get sleep data for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {string|null} [trustedUserId] - When supplied (e.g. from AuthContext), avoids relying on auth.getUser() readiness.
   * @returns {Promise<Object|null>} Sleep data record or null if not found
   */
  async getSleepDataForDate(date, trustedUserId = null) {
    try {
      let userId = trustedUserId;
      if (!userId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }
        userId = user.id;
      }

      let q = supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('date', date);
      q = await this._applyPreferredSourceFilter(q, userId);
      const { data, error } = await q
        .order('updated_at', { ascending: false }) // Get most recent first
        .limit(1); // Take only the most recent record

      if (error) {
        throw error;
      }

      const result = data && data.length > 0 ? data[0] : null;
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get sleep data for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {{ cacheNonce?: number }} [opts] - Pass a changing cacheNonce (e.g. strip refresh counter) so callers are not stuck with a cached empty range after focus/retry.
   * @returns {Promise<Array>} Array of sleep data records
   */
  async getSleepDataForRange(startDate, endDate, opts) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const cacheNonce =
        opts != null && typeof opts === 'object' && typeof opts.cacheNonce === 'number'
          ? opts.cacheNonce
          : 0;

      const seg = await this._cacheSegmentForUser(user.id);
      const cacheKey = `${user.id}:${startDate}-${endDate}:${seg}:n${cacheNonce}`;
      if (this._rangeCache[cacheKey]) {
        return this._rangeCache[cacheKey];
      }

      let q = supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      q = await this._applyPreferredSourceFilter(q, user.id);
      const { data, error } = await q.order('date', { ascending: false });

      if (error) {
        throw error;
      }

      const result = data || [];
      this._rangeCache[cacheKey] = result;
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Wake dates visible for the home week strip bed icons — same filtering as public.get_home_dashboard_data.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @param {{ cacheNonce?: number }} [opts]
   * @returns {Promise<string[]>} YYYY-MM-DD strings
   */
  async fetchVisibleSleepDatesForStrip(startDate, endDate, opts) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const cacheNonce =
        opts != null && typeof opts === 'object' && typeof opts.cacheNonce === 'number'
          ? opts.cacheNonce
          : 0;

      const cacheKey = `${user.id}:${startDate}:${endDate}:stripVis:n${cacheNonce}`;
      if (this._stripVisibilityCache[cacheKey]) {
        return this._stripVisibilityCache[cacheKey];
      }

      const { data, error } = await supabase.rpc('get_visible_sleep_dates_in_range', {
        p_user_id: user.id,
        p_start: startDate,
        p_end: endDate,
      });

      if (error) {
        throw error;
      }

      const dates = (data || []).map((row) =>
        typeof row === 'string' ? row : formatDateForDB(row)
      );
      this._stripVisibilityCache[cacheKey] = dates;
      return dates;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete sleep data for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSleepDataForDate(date) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .select();

      if (error) {
        throw error;
      }

      this._clearRangeCache();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all sleep data for the current user
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteAllSleepData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', user.id)
        .select('id', { count: 'exact' });

      if (error) {
        throw error;
      }

      this._clearRangeCache();
      const deletedCount = data?.length || 0;
      return deletedCount;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all habit logs for the current user
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteAllHabitLogs() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Delete from habit_logs table
      const { data: habitLogsData, error: habitLogsError } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', user.id)
        .select('id', { count: 'exact' });

      if (habitLogsError) throw habitLogsError;

      // Also delete from habit_consumption_events table (for quick consumption habits like caffeine)
      const { data: consumptionData, error: consumptionError } = await supabase
        .from('habit_consumption_events')
        .delete()
        .eq('user_id', user.id)
        .select('id', { count: 'exact' });

      if (consumptionError) throw consumptionError;

      const habitLogsDeleted = habitLogsData?.length || 0;
      const consumptionDeleted = consumptionData?.length || 0;
      const totalDeleted = habitLogsDeleted + consumptionDeleted;

      return totalDeleted;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get the latest sleep data record
   * @returns {Promise<Object|null>} Latest sleep data record or null
   */
  async getLatestSleepData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      let q = supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);
      q = await this._applyPreferredSourceFilter(q, user.id);
      const { data, error } = await q.single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      return data || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get sleep data summary for analytics
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Summary statistics
   */
  async getSleepDataSummary(days = 30) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateString = startDate.toISOString().split('T')[0];

      let q = supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateString);
      q = await this._applyPreferredSourceFilter(q, user.id);
      const { data, error } = await q;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalRecords: 0,
          averageSleepMinutes: 0,
          averageDeepSleepMinutes: 0,
          averageSleepScore: null,
          dateRange: { start: startDateString, end: new Date().toISOString().split('T')[0] }
        };
      }

      const validSleepScores = data.filter(record => record.sleep_score !== null);
      const averageSleepMinutes = Math.round(
        data.reduce((sum, record) => sum + record.total_sleep_minutes, 0) / data.length
      );
      const averageDeepSleepMinutes = Math.round(
        data.reduce((sum, record) => sum + record.deep_sleep_minutes, 0) / data.length
      );
      const averageSleepScore = validSleepScores.length > 0
        ? Math.round(validSleepScores.reduce((sum, record) => sum + record.sleep_score, 0) / validSleepScores.length)
        : null;

      return {
        totalRecords: data.length,
        averageSleepMinutes,
        averageDeepSleepMinutes,
        averageSleepScore,
        dateRange: { start: startDateString, end: new Date().toISOString().split('T')[0] }
      };
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
export default new SleepDataService();
