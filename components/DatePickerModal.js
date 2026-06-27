import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { formatDateForDB, getToday } from '../utils/dateHelpers';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import sleepDataService from '../services/sleepDataService';
import healthMetricsService from '../services/healthMetricsService';
import { INFERRED_HABIT_NAMES } from '../constants/inferredHabits';

const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect }) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Initialize to the month of the selected date
    return selectedDate ? new Date(selectedDate) : new Date();
  });
  const [loggedDates, setLoggedDates] = useState([]);
  const [sleepDataDates, setSleepDataDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user) {
      fetchLoggedDatesForMonth();
      fetchSleepDataDatesForMonth();
    }
  }, [visible, currentMonth, user]);

  const selectedCalendarDayKey =
    visible && selectedDate != null ? formatDateForDB(selectedDate) : null;

  useEffect(() => {
    if (!selectedCalendarDayKey) return;
    setCurrentMonth(new Date(selectedCalendarDayKey + 'T12:00:00'));
  }, [visible, selectedCalendarDayKey]);

  const isAutomatedInferredHabit = (habit) =>
    habit && INFERRED_HABIT_NAMES.includes(habit.name);

  const fetchLoggedDatesForMonth = async () => {
    if (!user) return;

    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // Get first and last day of month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startDate = formatDateForDB(firstDay);
      const endDate = formatDateForDB(lastDay);

      const loggedDatesSet = new Set();

      // 1. Get all habit logs for the month (with habit details)
      const { data: habitLogs, error: habitLogsError } = await supabase
        .from('habit_logs')
        .select(`
          date,
          habit_id,
          habits!inner(*)
        `)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (!habitLogsError && habitLogs) {
        // Group by date and check if any log is for a meaningful habit
        const datesWithLogs = new Set();
        habitLogs.forEach(log => {
          // Only count if it's not a health metric or automated bedtime habit
          if (!healthMetricsService.isHealthMetricHabit(log.habits) && 
              !isAutomatedInferredHabit(log.habits)) {
            datesWithLogs.add(log.date);
          }
        });
        datesWithLogs.forEach(date => loggedDatesSet.add(date));
      }

      // 2. Get all consumption events for the month
      const startDateTime = `${startDate}T00:00:00.000Z`;
      const endDateTime = `${endDate}T23:59:59.999Z`;
      
      const { data: consumptionEvents, error: consumptionError } = await supabase
        .from('habit_consumption_events')
        .select(`
          consumed_at,
          habits!inner(type)
        `)
        .eq('user_id', user.id)
        .gte('consumed_at', startDateTime)
        .lte('consumed_at', endDateTime);

      if (!consumptionError && consumptionEvents) {
        // Group by date and check if any event is for a quick_consumption habit
        const datesWithConsumption = new Set();
        consumptionEvents.forEach(event => {
          if (event.habits?.type === 'quick_consumption') {
            const eventDate = new Date(event.consumed_at);
            const dateString = formatDateForDB(eventDate);
            datesWithConsumption.add(dateString);
          }
        });
        datesWithConsumption.forEach(date => loggedDatesSet.add(date));
      }

      setLoggedDates(Array.from(loggedDatesSet));
    } catch (error) {
      setLoggedDates([]);
    }
  };

  const fetchSleepDataDatesForMonth = async () => {
    if (!user) return;

    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // Get first and last day of month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startDate = formatDateForDB(firstDay);
      const endDate = formatDateForDB(lastDay);

      let datesList = [];
      try {
        datesList = await sleepDataService.fetchVisibleSleepDatesForStrip(startDate, endDate);
      } catch (_e) {
        const sleepData = await sleepDataService.getSleepDataForRange(startDate, endDate);
        datesList = (sleepData || []).map((r) => formatDateForDB(r.date));
      }
      const sleepDateSet = new Set(
        (Array.isArray(datesList) ? datesList : []).map((d) => formatDateForDB(d))
      );
      setSleepDataDates(Array.from(sleepDateSet));
    } catch (error) {
      setSleepDataDates([]);
    }
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        day,
        date: formatDateForDB(date),
        fullDate: date,
      });
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    
    // Prevent navigating beyond the current month
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const newMonthValue = newMonth.getMonth();
    const newYear = newMonth.getFullYear();
    
    // Only allow navigation if the new month is not in the future
    if (newYear < todayYear || (newYear === todayYear && newMonthValue <= todayMonth)) {
      setCurrentMonth(newMonth);
    }
  };

  const handleDateSelect = (date) => {
    if (date) {
      const today = getToday();
      // Only allow selecting dates that are today or in the past
      if (date <= today) {
        onDateSelect(date);
        onClose();
      }
    }
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = getToday();
  
  // Check if we can navigate forward (not beyond current month)
  const todayDate = new Date();
  const currentMonthValue = currentMonth.getMonth();
  const currentYear = currentMonth.getFullYear();
  const canNavigateForward = currentYear < todayDate.getFullYear() || 
    (currentYear === todayDate.getFullYear() && currentMonthValue < todayDate.getMonth());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => navigateMonth(-1)}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.monthText}>{monthName}</Text>
                <TouchableOpacity
                  onPress={() => navigateMonth(1)}
                  style={styles.navButton}
                  disabled={!canNavigateForward}
                >
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={canNavigateForward ? colors.textPrimary : colors.textLight} 
                  />
                </TouchableOpacity>
              </View>

              {/* Day names */}
              <View style={styles.dayNamesRow}>
                {dayNames.map((dayName) => (
                  <View key={dayName} style={styles.dayNameCellWrapper}>
                    <View style={styles.dayNameCell}>
                      <Text style={styles.dayNameText}>{dayName}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.calendarGrid}>
                {days.map((dayItem, index) => {
                  if (!dayItem) {
                    return <View key={`empty-${index}`} style={styles.dateCellWrapper} />;
                  }

                  const isSelected = dayItem.date === selectedDate;
                  const isLogged = loggedDates.includes(dayItem.date);
                  const hasSleepData = sleepDataDates.includes(dayItem.date);
                  const isTodayDate = dayItem.date === today;
                  const isFuture = dayItem.date > today;

                  // Don't render future dates
                  if (isFuture) {
                    return <View key={dayItem.date} style={styles.dateCellWrapper} />;
                  }

                  // Determine background color based on data availability
                  let backgroundColorStyle = null;
                  if (isSelected) {
                    backgroundColorStyle = styles.selectedDateCell;
                  } else if (isLogged && hasSleepData) {
                    // Both habits and sleep data - use darker blue
                    backgroundColorStyle = styles.bothDataCell;
                  } else if (hasSleepData) {
                    // Only sleep data - use medium blue
                    backgroundColorStyle = styles.sleepDataCell;
                  } else if (isLogged) {
                    // Only habits logged - use light blue
                    backgroundColorStyle = styles.loggedDateCell;
                  }

                  return (
                    <View key={dayItem.date} style={styles.dateCellWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.dateCell,
                          backgroundColorStyle,
                          isTodayDate && !isSelected && styles.todayCell,
                        ]}
                        onPress={() => handleDateSelect(dayItem.date)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dateText,
                            isTodayDate && !isSelected && styles.todayText,
                            isSelected && styles.selectedText,
                          ]}
                        >
                          {dayItem.day}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Color Legend */}
              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Date Colors</Text>
                <View style={styles.legendItems}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, styles.loggedDateCell]} />
                    <Text style={styles.legendText}>Habits logged</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, styles.sleepDataCell]} />
                    <Text style={styles.legendText}>Sleep data</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, styles.bothDataCell]} />
                    <Text style={styles.legendText}>Both</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 280, // Fixed height to prevent layout shifts (reduced from 320)
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  dayNameCellWrapper: {
    width: '14.28%', // 7 columns
    paddingHorizontal: 2, // Match date cell margin
  },
  dayNameCell: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayNameText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 200, // Fixed height to accommodate 6 rows (reduced from 240)
  },
  dateCellWrapper: {
    width: '14.28%', // 7 columns - matches dayNameCellWrapper width exactly
    paddingHorizontal: 2, // Consistent spacing
    paddingVertical: 2, // Vertical spacing between rows
  },
  dateCell: {
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  dateText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  loggedDateCell: {
    backgroundColor: 'rgba(176, 205, 235, 0.45)', // Birthday Blue — habits only
  },
  sleepDataCell: {
    backgroundColor: 'rgba(36, 105, 178, 0.5)', // Cotton Blue — sleep data only
  },
  bothDataCell: {
    backgroundColor: 'rgba(17, 41, 75, 0.55)', // Blue Zodiac — habits + sleep
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  todayText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  selectedDateCell: {
    backgroundColor: colors.primary,
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  legend: {
    marginTop: spacing.regular,
    paddingTop: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});

export default DatePickerModal;

