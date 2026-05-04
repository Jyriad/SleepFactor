import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import sleepDataService from './sleepDataService';
import insightsService from './insightsService';

const QUEUE_STORAGE_KEY = 'offline_write_queue_v1';
const FLUSH_INTERVAL_MS = 15000;
const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 5 * 60 * 1000;

const ACTION_TYPES = {
  HABIT_LOG_UPSERT: 'habit_log_upsert',
  HABIT_LOG_DELETE: 'habit_log_delete',
  CONSUMPTION_CREATE: 'consumption_create',
  CONSUMPTION_UPDATE: 'consumption_update',
  SUBJECTIVE_UPSERT: 'subjective_upsert',
};

function nowMs() {
  return Date.now();
}

function buildId() {
  return `q_${nowMs()}_${Math.random().toString(36).slice(2, 10)}`;
}

class OfflineWriteQueueService {
  constructor() {
    this._queue = [];
    this._loaded = false;
    this._loadingPromise = null;
    this._isFlushing = false;
    this._interval = null;
  }

  async _ensureLoaded() {
    if (this._loaded) return;
    if (this._loadingPromise) {
      await this._loadingPromise;
      return;
    }
    this._loadingPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        this._queue = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        this._queue = [];
      } finally {
        this._loaded = true;
        this._loadingPromise = null;
      }
    })();
    await this._loadingPromise;
  }

  async _persist() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this._queue));
    } catch (_) {}
  }

  async start() {
    await this._ensureLoaded();
    if (!this._interval) {
      this._interval = setInterval(() => {
        this.flushNow();
      }, FLUSH_INTERVAL_MS);
    }
    this.flushNow();
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  async enqueue(type, payload, options = {}) {
    await this._ensureLoaded();
    const dedupeKey = options?.dedupeKey || null;

    if (dedupeKey) {
      const idx = this._queue.findIndex((item) => item.dedupeKey === dedupeKey);
      if (idx >= 0) {
        this._queue[idx] = {
          ...this._queue[idx],
          type,
          payload,
          nextAttemptAt: nowMs(),
          updatedAt: nowMs(),
        };
        await this._persist();
        return this._queue[idx].id;
      }
    }

    const item = {
      id: buildId(),
      type,
      payload,
      dedupeKey,
      createdAt: nowMs(),
      updatedAt: nowMs(),
      attemptCount: 0,
      nextAttemptAt: nowMs(),
    };
    this._queue.push(item);
    await this._persist();
    this.flushNow();
    return item.id;
  }

  async clearAll() {
    this._queue = [];
    this._loaded = true;
    await this._persist();
  }

  async flushNow() {
    await this._ensureLoaded();
    if (this._isFlushing) return;
    if (!this._queue.length) return;

    this._isFlushing = true;
    try {
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;
        const idx = this._queue.findIndex((item) => (item.nextAttemptAt || 0) <= nowMs());
        if (idx < 0) break;
        const item = this._queue[idx];
        try {
          await this._executeItem(item);
          this._queue.splice(idx, 1);
          madeProgress = true;
          await this._persist();
        } catch (_) {
          const attempts = (item.attemptCount || 0) + 1;
          const retryDelay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (attempts - 1));
          this._queue[idx] = {
            ...item,
            attemptCount: attempts,
            updatedAt: nowMs(),
            nextAttemptAt: nowMs() + retryDelay,
          };
          await this._persist();
        }
      }
    } finally {
      this._isFlushing = false;
    }
  }

  async _executeItem(item) {
    switch (item.type) {
      case ACTION_TYPES.HABIT_LOG_UPSERT: {
        const { userId, habitId, date, value } = item.payload || {};
        const { error } = await supabase.from('habit_logs').upsert(
          [{ user_id: userId, habit_id: habitId, date, value: String(value) }],
          { onConflict: 'user_id,habit_id,date' }
        );
        if (error) throw error;
        insightsService.notifyInsightsUnderlyingDataChanged();
        return;
      }
      case ACTION_TYPES.HABIT_LOG_DELETE: {
        const { userId, habitId, date } = item.payload || {};
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('user_id', userId)
          .eq('habit_id', habitId)
          .eq('date', date);
        if (error) throw error;
        insightsService.notifyInsightsUnderlyingDataChanged();
        return;
      }
      case ACTION_TYPES.CONSUMPTION_CREATE: {
        const { row } = item.payload || {};
        const { error } = await supabase.from('habit_consumption_events').insert(row);
        if (error) throw error;
        insightsService.notifyInsightsUnderlyingDataChanged();
        return;
      }
      case ACTION_TYPES.CONSUMPTION_UPDATE: {
        const { eventId, userId, updates } = item.payload || {};
        const { error } = await supabase
          .from('habit_consumption_events')
          .update(updates)
          .eq('id', eventId)
          .eq('user_id', userId);
        if (error) throw error;
        insightsService.notifyInsightsUnderlyingDataChanged();
        return;
      }
      case ACTION_TYPES.SUBJECTIVE_UPSERT: {
        const { userId, dateStr, payload } = item.payload || {};
        await sleepDataService.updateSubjectiveScores(userId, dateStr, payload || {});
        return;
      }
      default:
        return;
    }
  }
}

const offlineWriteQueueService = new OfflineWriteQueueService();
offlineWriteQueueService.ACTION_TYPES = ACTION_TYPES;

export default offlineWriteQueueService;
