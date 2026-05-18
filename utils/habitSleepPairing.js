import { addCalendarDay } from './dateHelpers';

/**
 * Wake-up date for sleep paired with a habit log on logDate (matches insightsService).
 */
export function getSleepDataDateForHabit(habit, logDate) {
  if (habit.type === 'quick_consumption') {
    return logDate;
  }
  if (habit.name === 'Bedtime Consistency') {
    return logDate;
  }
  if (habit.type === 'time') {
    return addCalendarDay(logDate);
  }
  return addCalendarDay(logDate);
}

/**
 * Minutes from logged clock time on log.date until sleep_start_time of the paired night.
 */
export function getTimeHabitMinutesBeforeBed(log, sleep) {
  const timeString = String(log.value || '').trim();
  if (!timeString || !timeString.includes(':')) return null;
  const parts = timeString.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const eventMs = new Date(`${log.date}T${pad(hours)}:${pad(minutes)}:00`).getTime();
  if (isNaN(eventMs)) return null;
  if (!sleep?.sleep_start_time) return null;
  const sleepStartMs = new Date(sleep.sleep_start_time).getTime();
  if (isNaN(sleepStartMs)) return null;
  if (eventMs >= sleepStartMs) return null;
  return (sleepStartMs - eventMs) / 60000;
}

/**
 * Extract numeric habit value from a log (binary → 0/1, drug → level_value).
 */
export function getHabitValueFromLog(log, habit) {
  if (habit.type === 'binary') {
    return log.value &&
      (String(log.value).toLowerCase() === 'yes' || log.value === '1' || log.value === true)
      ? 1
      : 0;
  }
  if (habit.type === 'numeric') {
    let value;
    if (log.numeric_value !== null && log.numeric_value !== undefined) {
      value = log.numeric_value;
    } else {
      const stringValue = String(log.value || '').trim();
      if (
        !stringValue ||
        stringValue.startsWith('N') ||
        stringValue.startsWith('n') ||
        stringValue === 'null' ||
        stringValue === 'undefined' ||
        stringValue.includes(' ') ||
        isNaN(Number(stringValue))
      ) {
        return 0;
      }
      value = parseFloat(stringValue);
    }
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return value;
  }
  if (habit.type === 'quick_consumption') {
    const value = log.level_value;
    if (value === null || value === undefined || isNaN(value)) {
      return 0;
    }
    return value;
  }
  if (habit.type === 'time') {
    return null;
  }
  return 0;
}

/**
 * Pair habit logs with sleep rows using the same rules as Insights.
 * @param {Object} habit
 * @param {Array} habitData - logs or drug_levels rows for this habit
 * @param {Object} sleepByDate - map date string → sleep row
 * @param {string} sleepMetric
 * @param {{ useEfficiency?: boolean, transformSleep?: Function }} options
 * @returns {Array} paired data points (excludes excluded rows when includeExcluded is false)
 */
export function buildPairedDayPoints(habit, habitData, sleepByDate, sleepMetric, options = {}) {
  const { useEfficiency = false, transformSleep = null, includeExcluded = false } = options;
  const isTimeHabit = habit.type === 'time';
  const dataPoints = [];

  if (!habitData || habitData.length === 0) {
    return dataPoints;
  }

  habitData.forEach((log) => {
    const sleepDataDate = getSleepDataDateForHabit(habit, log.date);
    const sleep = sleepByDate[sleepDataDate];

    if (!sleep || sleep[sleepMetric] === null || sleep[sleepMetric] === undefined) {
      return;
    }

    let habitValue;
    if (isTimeHabit) {
      habitValue = getTimeHabitMinutesBeforeBed(log, sleep);
      if (habitValue === null || habitValue <= 0) {
        return;
      }
    } else {
      habitValue = getHabitValueFromLog(log, habit);
    }

    let sleepValue = sleep[sleepMetric];
    if (useEfficiency && typeof transformSleep === 'function') {
      sleepValue = transformSleep(sleep, sleepMetric);
    }

    const excluded = !!log.exclude_from_insights || !!sleep.exclude_from_insights;
    if (!includeExcluded && excluded) {
      return;
    }

    if (
      habitValue !== null &&
      habitValue !== undefined &&
      !isNaN(habitValue) &&
      sleepValue !== null &&
      sleepValue !== undefined &&
      !isNaN(sleepValue)
    ) {
      dataPoints.push({
        habitValue,
        sleepValue,
        date: log.date,
        sleepDate: sleep.date,
        habitLog: log,
        sleepData: sleep,
        exclude_from_insights: excluded,
        auto_excluded: !!log.auto_excluded || !!sleep.auto_excluded,
        exclusion_reason: log.exclusion_reason || sleep.exclusion_reason,
      });
    }
  });

  return dataPoints;
}

export function getBinaryHabitDisplay(habitValue) {
  if (habitValue === 1) return 'yes';
  if (habitValue === 0) return 'no';
  return null;
}
