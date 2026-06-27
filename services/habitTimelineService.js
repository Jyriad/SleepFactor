import { supabase } from './supabase';
import insightsService from './insightsService';
import {
  buildPairedDayPoints,
  getBinaryHabitDisplay,
  getHabitValueFromLog,
  getSleepDataDateForHabit,
  getTimeHabitMinutesBeforeBed,
} from '../utils/habitSleepPairing';
import { isInsightDisplayable } from '../utils/insightDisplayGate';
import { getInsightImpactDisplay } from '../utils/insightImpactDisplay';
import { addCalendarDay, formatDateForDB, getToday } from '../utils/dateHelpers';

const DEFAULT_RANGE_DAYS = 365;
/** Days of history fetched for the habit timeline (one year). */
export const TIMELINE_FETCH_DAYS = 365;

function subtractCalendarDays(dateStr, days) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d - days);
  return formatDateForDB(date);
}

function enumerateCalendarDays(startDateStr, endDateStr) {
  const dates = [];
  let current = startDateStr;
  while (current <= endDateStr) {
    dates.push(current);
    current = addCalendarDay(current);
  }
  return dates;
}

class HabitTimelineService {
  /**
   * @param {string} userId
   * @param {string} habitId
   * @param {{ rangeDays?: number, sleepMetricKey: string, useEfficiency?: boolean }} options
   */
  async getHabitTimelineSeries(userId, habitId, options = {}) {
    const {
      rangeDays = DEFAULT_RANGE_DAYS,
      sleepMetricKey,
      useEfficiency = false,
    } = options;

    if (!userId || !habitId || !sleepMetricKey) {
      throw new Error('userId, habitId, and sleepMetricKey are required');
    }

    const endDateStr = getToday();
    const startDateStr = subtractCalendarDays(endDateStr, rangeDays - 1);
    const startDate = new Date(`${startDateStr}T12:00:00`);
    const endDate = new Date(`${endDateStr}T12:00:00`);

    const { data: habitRow, error: habitError } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .eq('user_id', userId)
      .single();

    if (habitError || !habitRow) {
      throw new Error('Habit not found');
    }

    const habit = habitRow;
    const metrics = await insightsService.getAvailableSleepMetricsForUser(userId);
    const sleepMetric =
      metrics.find((m) => m.key === sleepMetricKey) || metrics[0] || { key: sleepMetricKey, label: 'Sleep', unit: '' };

    let habitData;
    if (habit.type === 'quick_consumption') {
      const allLevels = await insightsService.getDrugLevels(userId, startDate, endDate);
      habitData = (allLevels || []).filter((row) => row.habit_id === habitId);
    } else {
      const allLogs = await insightsService.getHabitLogs(userId, startDate, endDate, false);
      habitData = (allLogs || []).filter((row) => row.habit_id === habitId);
    }

    const sleepData = await insightsService.getSleepData(userId, startDate, endDate, false);
    const sleepByDate = {};
    (sleepData || []).forEach((sleep) => {
      sleepByDate[sleep.date] = sleep;
    });

    const pairedPoints = buildPairedDayPoints(habit, habitData, sleepByDate, sleepMetricKey, {
      useEfficiency,
      transformSleep: (sleep, metric) => insightsService.transformSleepDataForEfficiency(sleep, metric),
      includeExcluded: false,
    });

    const pairedByLogDate = new Map();
    pairedPoints.forEach((p) => {
      pairedByLogDate.set(p.date, p);
    });

    const logsByDate = new Map();
    (habitData || []).forEach((log) => {
      if (log.exclude_from_insights) return;
      logsByDate.set(log.date, log);
    });

    const calendarDays = enumerateCalendarDays(startDateStr, endDateStr);
    const days = calendarDays.map((date) => {
      const paired = pairedByLogDate.get(date);
      if (paired) {
        const habitDisplay =
          habit.type === 'binary'
            ? getBinaryHabitDisplay(paired.habitValue)
            : paired.habitValue;
        return {
          date,
          habitValue: paired.habitValue,
          habitDisplay,
          sleepValue: paired.sleepValue,
          sleepDate: paired.sleepDate,
          habitLog: paired.habitLog,
          sleepData: paired.sleepData,
          excluded: false,
        };
      }

      const log = logsByDate.get(date);
      if (!log) {
        return {
          date,
          habitValue: null,
          habitDisplay: null,
          sleepValue: null,
          sleepDate: null,
          habitLog: null,
          sleepData: null,
          excluded: false,
        };
      }

      const sleepDataDate = getSleepDataDateForHabit(habit, date);
      const sleep = sleepByDate[sleepDataDate];
      let habitValue = null;
      let habitDisplay = null;

      if (habit.type === 'time') {
        if (sleep) {
          const minutes = getTimeHabitMinutesBeforeBed(log, sleep);
          if (minutes != null && minutes > 0) {
            habitValue = minutes;
            habitDisplay = minutes;
          }
        }
      } else {
        habitValue = getHabitValueFromLog(log, habit);
        habitDisplay =
          habit.type === 'binary' ? getBinaryHabitDisplay(habitValue) : habitValue;
      }

      return {
        date,
        habitValue,
        habitDisplay,
        sleepValue: null,
        sleepDate: sleep?.date ?? null,
        habitLog: log,
        sleepData: sleep ?? null,
        excluded: false,
      };
    });

    const loggedDayCount = days.filter((d) => d.habitValue !== null && d.habitDisplay !== null).length;

    return {
      days,
      habit,
      sleepMetric,
      loggedDayCount,
      rangeStart: startDateStr,
      rangeEnd: endDateStr,
    };
  }

  /**
   * Insight footer for timeline: full-history bundle row for habit + metric + analysis mode.
   */
  async getHabitTimelineInsightFooter(userId, habitId, sleepMetricKey, analysisMode = 'absolute') {
    const [{ habitGroups }, taggedInsight] = await Promise.all([
      insightsService.getInsightsScreenBundle(userId),
      insightsService.getTaggedInsightForHabitMetric(
        userId,
        habitId,
        sleepMetricKey,
        analysisMode
      ),
    ]);

    const group = (habitGroups?.groups || []).find((g) => g.habitId === habitId);
    if (!group) {
      return { state: 'unknown', habit: null, progress: null, insight: null, noLink: false };
    }

    const noLink =
      analysisMode === 'percentage' ? group.noLinkPercentage : group.noLinkAbsolute;
    const insight = taggedInsight;
    const confidenceLevel = insight?.confidenceLevel || 'none';

    const metrics = await insightsService.getAvailableSleepMetricsForUser(userId);
    const alsoAffects = metrics
      .map((m) => {
        const ins = (group.insightsAbsolute || []).find((i) => i.metricKey === m.key);
        if (!ins || !isInsightDisplayable(ins)) return null;
        const isPct = ins.analysisType === 'percentage';
        const impactDisplay = getInsightImpactDisplay(ins, m, isPct);
        return {
          metricKey: m.key,
          metricLabel: m.label,
          direction: ins.direction === 'negative' ? 'negative' : 'positive',
          impactLevel: ins.impactLevel || 'minimal',
          impactPercent: impactDisplay?.relativePercent ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.metricKey === sleepMetricKey) return -1;
        if (b.metricKey === sleepMetricKey) return 1;
        return (a.metricLabel || '').localeCompare(b.metricLabel || '');
      });

    let state = 'building';
    if (insight && confidenceLevel !== 'none') {
      state = 'insight';
    } else if (insight && confidenceLevel === 'none' && group.progress?.ready) {
      state = 'noLink';
    } else if (noLink && group.progress?.ready) {
      state = 'noLink';
    } else if (!group.progress?.ready) {
      state = 'building';
    } else if (insight) {
      state = 'noLink';
    } else {
      state = 'noInsight';
    }

    return {
      state,
      habit: group.habit,
      progress: group.progress,
      insight,
      noLink,
      timesLogged: group.timesLogged ?? 0,
      alsoAffects,
    };
  }
}

export default new HabitTimelineService();
