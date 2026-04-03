import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import healthMetricsService from '../services/healthMetricsService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateForDB, getToday } from '../utils/dateHelpers';

const DAY_CELL_SIZE = 36;
const DAY_CELL_PADDING = 4;
const DAY_CELL_BORDER_RADIUS = 8;
const CALENDAR_CELL_PADDING_V = 6;

const isAutomatedBedtimeHabit = (habit) =>
  habit && habit.name === 'Bedtime Consistency';

export default function DatePickerCalendar({
  currentMonth,
  setCurrentMonth,
  selectedDateStr,
  onDateSelect,
  onClose,
  /** Match DateHeader glass mode: dark text/icons on frosted background */
  glass = false,
}) {
  const { user } = useAuth();
  const [calendarLoggedDates, setCalendarLoggedDates] = React.useState([]);
  const [calendarSleepDataDates, setCalendarSleepDataDates] = React.useState([]);

  useEffect(() => {
    if (!user) return;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = formatDateForDB(firstDay);
    const endDate = formatDateForDB(lastDay);

    const loggedSet = new Set();
    Promise.all([
      supabase
        .from('habit_logs')
        .select('date, habit_id, habits!inner(*)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .then(({ data: habitLogs }) => {
          (habitLogs || []).forEach((log) => {
            if (
              !healthMetricsService.isHealthMetricHabit(log.habits) &&
              !isAutomatedBedtimeHabit(log.habits)
            ) {
              loggedSet.add(log.date);
            }
          });
        }),
      supabase
        .from('habit_consumption_events')
        .select('consumed_at, habits!inner(type)')
        .eq('user_id', user.id)
        .gte('consumed_at', `${startDate}T00:00:00.000Z`)
        .lte('consumed_at', `${endDate}T23:59:59.999Z`)
        .then(({ data: consumptionEvents }) => {
          (consumptionEvents || []).forEach((event) => {
            if (event.habits?.type === 'quick_consumption') {
              const eventDate = new Date(event.consumed_at);
              loggedSet.add(formatDateForDB(eventDate));
            }
          });
        }),
    ]).then(() => setCalendarLoggedDates(Array.from(loggedSet)));

    sleepDataService
      .getSleepDataForRange(startDate, endDate)
      .then((sleepData) => {
        const valid = (sleepData || []).filter((r) => !r.exclude_from_insights);
        setCalendarSleepDataDates(valid.map((r) => r.date));
      })
      .catch(() => setCalendarSleepDataDates([]));
  }, [user, currentMonth]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      day,
      date: formatDateForDB(date),
      fullDate: date,
    });
  }

  const monthName = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = getToday();
  const todayDate = new Date();
  const canForward =
    currentMonth.getFullYear() < todayDate.getFullYear() ||
    (currentMonth.getFullYear() === todayDate.getFullYear() &&
      currentMonth.getMonth() < todayDate.getMonth());

  const navigateMonth = (dir) => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + dir);
    if (
      next.getFullYear() < todayDate.getFullYear() ||
      (next.getFullYear() === todayDate.getFullYear() &&
        next.getMonth() <= todayDate.getMonth())
    ) {
      setCurrentMonth(next);
    }
  };

  const handleDateSelect = (date) => {
    if (date && date <= today) {
      onDateSelect(date);
    }
  };

  const monthTextStyle = glass ? styles.calMonthTextGlass : styles.calMonthText;
  const dayNameStyle = glass ? styles.dayNameTextGlass : styles.dayNameText;
  const navBack = glass ? colors.textPrimary : colors.white;
  const navFwd = canForward
    ? glass
      ? colors.textPrimary
      : colors.white
    : glass
      ? colors.textLight
      : 'rgba(255,255,255,0.4)';

  return (
    <View style={styles.calendarWrap}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => navigateMonth(-1)}
          style={styles.calNavBtn}
        >
          <Ionicons name="chevron-back" size={24} color={navBack} />
        </TouchableOpacity>
        <Text style={monthTextStyle}>{monthName}</Text>
        <TouchableOpacity
          onPress={() => navigateMonth(1)}
          style={styles.calNavBtn}
          disabled={!canForward}
        >
          <Ionicons name="chevron-forward" size={24} color={navFwd} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayNamesRow}>
        {dayNames.map((dn) => (
          <View key={dn} style={styles.dayNameCellWrapper}>
            <Text style={dayNameStyle}>{dn}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((dayItem, index) => {
          if (!dayItem) {
            return <View key={`e-${index}`} style={styles.dateCellWrapper} />;
          }
          const isSelected = dayItem.date === selectedDateStr;
          const isLogged = calendarLoggedDates.includes(dayItem.date);
          const hasSleep = calendarSleepDataDates.includes(dayItem.date);
          const isTodayDate = dayItem.date === today;
          const isFuture = dayItem.date > today;

          const futureCell = glass ? styles.calFutureCellGlass : styles.calFutureCell;
          const baseCell = glass ? styles.calDateCellGlass : styles.calDateCell;
          const bg = isFuture
            ? futureCell
            : isSelected
              ? styles.calSelectedCell
              : null;

          const dateTextBase = glass ? styles.calDateTextGlass : styles.calDateText;
          const todayTextExtra =
            isTodayDate && !isSelected && !isFuture
              ? glass
                ? styles.calTodayTextGlass
                : styles.calTodayText
              : null;
          const iconMuted = glass ? colors.textSecondary : 'rgba(255,255,255,0.9)';

          return (
            <View key={dayItem.date} style={styles.dateCellWrapper}>
              <TouchableOpacity
                style={[
                  baseCell,
                  bg,
                  isTodayDate && !isFuture && styles.calTodayCell,
                ]}
                onPress={() => !isFuture && handleDateSelect(dayItem.date)}
                activeOpacity={isFuture ? 1 : 0.7}
                disabled={isFuture}
              >
                <Text
                  style={[
                    dateTextBase,
                    todayTextExtra,
                    isSelected && styles.calSelectedText,
                    isFuture && (glass ? styles.calFutureTextGlass : styles.calFutureText),
                  ]}
                >
                  {dayItem.day}
                </Text>
                {isLogged && (
                  <View style={styles.calIndicatorLeft} pointerEvents="none">
                    <Ionicons name="checkmark" size={10} color={isSelected ? colors.primary : iconMuted} />
                  </View>
                )}
                {hasSleep && (
                  <View style={styles.calSleepIcon} pointerEvents="none">
                    <Ionicons name="bed-outline" size={10} color={isSelected ? colors.primary : iconMuted} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Horizontal padding comes from DateHeader container only — avoids double inset so the
  // month grid lines up with the 7-day strip above when the header is expanded.
  calendarWrap: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 0,
    minHeight: 28,
  },
  calNavBtn: {
    padding: spacing.xs,
  },
  calMonthText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  dayNameCellWrapper: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 0,
  },
  dayNameText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: 'rgba(255,255,255,0.85)',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 0,
    marginBottom: 0,
  },
  dateCellWrapper: {
    width: '14.28%',
    paddingHorizontal: DAY_CELL_PADDING / 2,
    paddingVertical: CALENDAR_CELL_PADDING_V,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDateCell: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  calIndicatorLeft: {
    position: 'absolute',
    bottom: 2,
    left: 2,
  },
  calSleepIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  calDateText: {
    fontSize: typography.sizes.small,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.weights.medium,
  },
  calTodayCell: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  calTodayText: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  calSelectedCell: {
    backgroundColor: colors.white,
  },
  calSelectedText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  calFutureCell: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  calFutureText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: typography.weights.medium,
  },
  calMonthTextGlass: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dayNameTextGlass: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  calDateCellGlass: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 41, 75, 0.12)',
    position: 'relative',
  },
  calDateTextGlass: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  calTodayTextGlass: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  calFutureCellGlass: {
    backgroundColor: 'rgba(17, 41, 75, 0.06)',
  },
  calFutureTextGlass: {
    color: colors.textLight,
    fontWeight: typography.weights.medium,
  },
});
