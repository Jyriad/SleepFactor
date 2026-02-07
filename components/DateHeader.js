import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import healthMetricsService from '../services/healthMetricsService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  formatDateForDB,
  formatDateTitle,
  getDateStripArrayCentered,
  getToday,
} from '../utils/dateHelpers';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STRIP_DAYS = 7;
const HANDLE_HEIGHT = 18;
const STRIP_ROW_HEIGHT = 64;
const TOP_ROW_HEIGHT = 44;
const CALENDAR_HEADER_HEIGHT = 28;
const CALENDAR_DAY_NAMES_HEIGHT = 16;
const CALENDAR_CELL_VERTICAL_PADDING = 6;
const CALENDAR_ROW_HEIGHT = 36 + CALENDAR_CELL_VERTICAL_PADDING * 2;

function getCalendarExpandedHeight(currentMonth) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const totalCells = startingDayOfWeek + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  return CALENDAR_HEADER_HEIGHT + CALENDAR_DAY_NAMES_HEIGHT + rows * CALENDAR_ROW_HEIGHT + HANDLE_HEIGHT;
}

// When expandHeight is above this, strip and top row are fully hidden (0). Keeps them gone when drawer is open.
const COLLAPSE_THRESHOLD = 250;

const SPRING_CONFIG = {
  damping: 24,
  stiffness: 280,
};

const isAutomatedBedtimeHabit = (habit) =>
  habit && habit.name === 'Bedtime Consistency';

const DateHeader = ({
  selectedDate,
  onDateChange,
  loggedDates = [],
  datesWithUnsavedChanges = [],
  leftElement = null,
  rightElement = null,
  showTodayButton = true,
}) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() =>
    selectedDate ? new Date(selectedDate) : new Date()
  );
  const [calendarLoggedDates, setCalendarLoggedDates] = useState([]);
  const [calendarSleepDataDates, setCalendarSleepDataDates] = useState([]);
  const [stripSleepDates, setStripSleepDates] = useState([]);

  const expandHeight = useSharedValue(HANDLE_HEIGHT);
  const startHeight = useSharedValue(HANDLE_HEIGHT);
  const calendarMaxHeight = useSharedValue(getCalendarExpandedHeight(selectedDate ? new Date(selectedDate) : new Date()));
  const calendarSlideOffset = useSharedValue(0);
  const PANEL_WIDTH = SCREEN_WIDTH - 2 * spacing.regular;
  const SWIPE_COMMIT_THRESHOLD = PANEL_WIDTH * 0.25;

  const selectedDateStr =
    typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate);
  const todayStr = getToday();
  const stripCenterDate = selectedDate
    ? (typeof selectedDate === 'string' ? new Date(selectedDate + 'T12:00:00') : selectedDate)
    : new Date();
  const stripDates = getDateStripArrayCentered(stripCenterDate, STRIP_DAYS);
  const displayTitle = formatDateTitle(selectedDate);
  const showToday = showTodayButton && displayTitle !== 'Today' && selectedDateStr >= todayStr;

  const prevMonth = useMemo(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    return d;
  }, [currentMonth]);
  const nextMonth = useMemo(() => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [selectedDate]);

  useEffect(() => {
    calendarMaxHeight.value = getCalendarExpandedHeight(currentMonth);
  }, [currentMonth]);

  const commitNextMonthDone = useCallback(() => {
    goToNextMonth();
  }, [goToNextMonth]);

  const commitPrevMonthDone = useCallback(() => {
    goToPrevMonth();
  }, [goToPrevMonth]);

  useLayoutEffect(() => {
    calendarSlideOffset.value = 0;
  }, [currentMonth]);

  useEffect(() => {
    if (stripDates.length === 0) return;
    const start = stripDates[0].date;
    const end = stripDates[stripDates.length - 1].date;
    sleepDataService
      .getSleepDataForRange(start, end)
      .then((data) => {
        const valid = (data || []).filter((r) => !r.exclude_from_insights);
        setStripSleepDates(valid.map((r) => r.date));
      })
      .catch(() => setStripSleepDates([]));
  }, [stripDates[0]?.date, stripDates[stripDates.length - 1]?.date]);

  const handleTodayPress = () => {
    const today = new Date(todayStr + 'T12:00:00');
    onDateChange(today);
  };

  const openCalendar = () => {
    calendarSlideOffset.value = 0;
    calendarMaxHeight.value = getCalendarExpandedHeight(currentMonth);
    expandHeight.value = withSpring(calendarMaxHeight.value, SPRING_CONFIG);
  };

  const closeCalendar = () => {
    expandHeight.value = withTiming(HANDLE_HEIGHT, { duration: 220 });
  };

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    const todayDate = new Date();
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      const canForward =
        next.getFullYear() < todayDate.getFullYear() ||
        (next.getFullYear() === todayDate.getFullYear() &&
          next.getMonth() <= todayDate.getMonth());
      return canForward ? next : prev;
    });
  }, []);

  const SWIPE_THRESHOLD = 28;
  const horizontalSwipeGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
    .failOffsetY([-35, 35])
    .onUpdate((e) => {
      if (expandHeight.value <= HANDLE_HEIGHT + 20) return;
      const tx = e.translationX;
      const maxDrag = PANEL_WIDTH * 0.85;
      calendarSlideOffset.value = Math.max(-maxDrag, Math.min(maxDrag, tx));
    })
    .onEnd((e) => {
      if (expandHeight.value <= HANDLE_HEIGHT + 20) return;
      const tx = calendarSlideOffset.value;
      const velocity = e.velocityX;
      const commitNext = tx < -SWIPE_COMMIT_THRESHOLD || (tx < 0 && velocity < -200);
      const commitPrev = tx > SWIPE_COMMIT_THRESHOLD || (tx > 0 && velocity > 200);
      if (commitNext) {
        calendarSlideOffset.value = withTiming(
          -PANEL_WIDTH,
          { duration: 260 },
          (finished) => {
            if (finished) runOnJS(commitNextMonthDone)();
          }
        );
      } else if (commitPrev) {
        calendarSlideOffset.value = withTiming(
          PANEL_WIDTH,
          { duration: 260 },
          (finished) => {
            if (finished) runOnJS(commitPrevMonthDone)();
          }
        );
      } else {
        calendarSlideOffset.value = withTiming(0, { duration: 260 });
      }
    });

  const verticalPanGesture = Gesture.Pan()
    .activeOffsetY([-30, 30])
    .onStart(() => {
      startHeight.value = expandHeight.value;
    })
    .onUpdate((e) => {
      const next = startHeight.value + e.translationY;
      const maxH = calendarMaxHeight.value;
      expandHeight.value = Math.max(
        HANDLE_HEIGHT,
        Math.min(maxH, next)
      );
    })
    .onEnd((e) => {
      const maxH = calendarMaxHeight.value;
      const draggedUp = e.translationY < -15 || e.velocityY < -80;
      const draggedDown = e.translationY > 15 || e.velocityY > 120;
      const shouldOpen = draggedDown ||
        (e.velocityY > 0 && expandHeight.value > maxH * 0.35) ||
        expandHeight.value > maxH * 0.5;
      const shouldClose = draggedUp ||
        (e.velocityY < 0 && expandHeight.value < maxH * 0.5);
      if (shouldClose && expandHeight.value > HANDLE_HEIGHT) {
        expandHeight.value = withTiming(HANDLE_HEIGHT, { duration: 220 });
      } else if (shouldOpen) {
        expandHeight.value = withSpring(maxH, SPRING_CONFIG);
      }
    });

  const panGesture = Gesture.Race(verticalPanGesture, horizontalSwipeGesture);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    height: expandHeight.value,
    overflow: 'hidden',
  }));

  const calendarContentStyle = useAnimatedStyle(() => ({
    height: Math.max(0, expandHeight.value - HANDLE_HEIGHT),
    overflow: 'hidden',
  }));

  const calendarRowStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: PANEL_WIDTH * 3,
    transform: [{ translateX: -PANEL_WIDTH + calendarSlideOffset.value }],
  }));

  const stripRowStyle = useAnimatedStyle(() => {
    const v = Math.min(expandHeight.value, COLLAPSE_THRESHOLD);
    const h = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [STRIP_ROW_HEIGHT, 0]
    );
    const op = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [1, 0]
    );
    const pad = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [4, 0]
    );
    const isExp = expandHeight.value > HANDLE_HEIGHT + 15;
    return {
      position: isExp ? 'absolute' : 'relative',
      top: isExp ? 0 : undefined,
      left: isExp ? 0 : undefined,
      right: isExp ? 0 : undefined,
      height: h,
      overflow: 'hidden',
      opacity: op,
      paddingVertical: pad,
      paddingBottom: pad,
      zIndex: isExp ? -1 : 0,
    };
  });

  const topRowStyle = useAnimatedStyle(() => {
    const v = Math.min(expandHeight.value, COLLAPSE_THRESHOLD);
    const h = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [TOP_ROW_HEIGHT, 0]
    );
    const op = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [1, 0]
    );
    const pad = interpolate(
      v,
      [HANDLE_HEIGHT, COLLAPSE_THRESHOLD],
      [4, 0]
    );
    const isExp = expandHeight.value > HANDLE_HEIGHT + 15;
    return {
      position: isExp ? 'absolute' : 'relative',
      top: isExp ? 0 : undefined,
      left: isExp ? 0 : undefined,
      right: isExp ? 0 : undefined,
      height: h,
      overflow: 'hidden',
      opacity: op,
      paddingVertical: pad,
      zIndex: isExp ? -1 : 0,
    };
  });

  return (
    <View style={styles.container}>
      {/* Drag down from anywhere on minimised selector (date row, strip, or handle) to open; swipe up from anywhere when expanded to close */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.headerContent}>
          {/* Top row: collapses when expanded so month header takes its place */}
          <Animated.View style={topRowStyle}>
            <View style={styles.topRow}>
            <View style={styles.leftSlot}>
              {leftElement != null ? (
                leftElement
              ) : showToday ? (
                <TouchableOpacity
                  onPress={handleTodayPress}
                  style={styles.todayButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.todayButtonText}>Today</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.dateChip}>
              <Text style={styles.dateChipText}>{displayTitle}</Text>
            </View>

            <View style={styles.rightSlot}>{rightElement}</View>
            </View>
          </Animated.View>

          {/* 7-day strip — collapses to 0 height when drawer expanded */}
          <Animated.View style={[styles.stripRow, stripRowStyle]}>
            {stripDates.map((dateItem) => {
              const isSelected = dateItem.date === selectedDateStr;
              const isLogged = loggedDates.includes(dateItem.date);
              const hasSleep = stripSleepDates.includes(dateItem.date);
              return (
                <TouchableOpacity
                  key={dateItem.date}
                  style={styles.stripItem}
                  onPress={() => {
                    const d = new Date(dateItem.date + 'T12:00:00');
                    onDateChange(d);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.stripDayName,
                      isSelected && styles.stripDayNameSelected,
                    ]}
                  >
                    {dateItem.dayName}
                  </Text>
                  <View
                    style={[
                      styles.datePill,
                      isSelected && styles.datePillSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.datePillNumber,
                        isSelected && styles.datePillNumberSelected,
                      ]}
                    >
                      {dateItem.dayNumber}
                    </Text>
                    {isLogged && (
                      <View style={styles.datePillIndicatorLeft} pointerEvents="none">
                        <Ionicons name="checkmark" size={10} color={isSelected ? colors.primary : 'rgba(255,255,255,0.9)'} />
                      </View>
                    )}
                    {hasSleep && (
                      <Text style={[styles.datePillZzz, isSelected && styles.datePillZzzSelected]} pointerEvents="none">Zzz</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Drawer: calendar + handle at bottom */}
          <Animated.View style={drawerAnimatedStyle}>
            <Animated.View style={calendarContentStyle}>
              <Animated.View style={calendarRowStyle}>
                <View style={[styles.calendarPanel, { width: PANEL_WIDTH }]} pointerEvents="box-none">
                  <ExpandedCalendar
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    selectedDateStr={selectedDateStr}
                    onDateSelect={(dateStr) => {
                      onDateChange(new Date(dateStr + 'T12:00:00'));
                      closeCalendar();
                    }}
                    onClose={closeCalendar}
                    user={user}
                    calendarLoggedDates={[]}
                    setCalendarLoggedDates={setCalendarLoggedDates}
                    calendarSleepDataDates={[]}
                    setCalendarSleepDataDates={setCalendarSleepDataDates}
                    displayMonth={prevMonth}
                  />
                </View>
                <View style={[styles.calendarPanel, { width: PANEL_WIDTH }]} pointerEvents="box-none">
                  <ExpandedCalendar
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    selectedDateStr={selectedDateStr}
                    onDateSelect={(dateStr) => {
                      onDateChange(new Date(dateStr + 'T12:00:00'));
                      closeCalendar();
                    }}
                    onClose={closeCalendar}
                    user={user}
                    calendarLoggedDates={calendarLoggedDates}
                    setCalendarLoggedDates={setCalendarLoggedDates}
                    calendarSleepDataDates={calendarSleepDataDates}
                    setCalendarSleepDataDates={setCalendarSleepDataDates}
                    displayMonth={null}
                  />
                </View>
                <View style={[styles.calendarPanel, { width: PANEL_WIDTH }]} pointerEvents="box-none">
                  <ExpandedCalendar
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    selectedDateStr={selectedDateStr}
                    onDateSelect={(dateStr) => {
                      onDateChange(new Date(dateStr + 'T12:00:00'));
                      closeCalendar();
                    }}
                    onClose={closeCalendar}
                    user={user}
                    calendarLoggedDates={[]}
                    setCalendarLoggedDates={setCalendarLoggedDates}
                    calendarSleepDataDates={[]}
                    setCalendarSleepDataDates={setCalendarSleepDataDates}
                    displayMonth={nextMonth}
                  />
                </View>
              </Animated.View>
            </Animated.View>
            <TouchableOpacity
              style={styles.dragHandleBarWrap}
              onPress={openCalendar}
              activeOpacity={1}
            >
              <View style={styles.dragHandleBar} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
};

function ExpandedCalendar({
  currentMonth,
  setCurrentMonth,
  selectedDateStr,
  onDateSelect,
  onClose,
  user,
  calendarLoggedDates,
  setCalendarLoggedDates,
  calendarSleepDataDates,
  setCalendarSleepDataDates,
  displayMonth = null,
}) {
  const showMonth = displayMonth ?? currentMonth;
  const isInteractive = displayMonth == null;

  useEffect(() => {
    if (!user || !isInteractive) return;
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
  }, [user, currentMonth, isInteractive]);

  const year = showMonth.getFullYear();
  const month = showMonth.getMonth();
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

  const monthName = showMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = getToday();
  const todayDate = new Date();
  const canForward =
    showMonth.getFullYear() < todayDate.getFullYear() ||
    (showMonth.getFullYear() === todayDate.getFullYear() &&
      showMonth.getMonth() < todayDate.getMonth());

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

  return (
    <View style={styles.calendarWrap}>
      <View style={styles.calendarHeader}>
        {isInteractive ? (
          <>
            <TouchableOpacity
              onPress={() => navigateMonth(-1)}
              style={styles.calNavBtn}
            >
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.calMonthText}>{monthName}</Text>
            <TouchableOpacity
              onPress={() => navigateMonth(1)}
              style={styles.calNavBtn}
              disabled={!canForward}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canForward ? colors.white : 'rgba(255,255,255,0.4)'}
              />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.calendarHeaderTitleOnly}>
            <Text style={styles.calMonthText}>{monthName}</Text>
          </View>
        )}
      </View>

      <View style={styles.dayNamesRow}>
        {dayNames.map((dn) => (
          <View key={dn} style={styles.dayNameCellWrapper}>
            <Text style={styles.dayNameText}>{dn}</Text>
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

          const bg = isFuture
            ? styles.calFutureCell
            : isSelected
              ? styles.calSelectedCell
              : null;

          return (
            <View key={dayItem.date} style={styles.dateCellWrapper}>
              <TouchableOpacity
                style={[
                  styles.calDateCell,
                  bg,
                  isTodayDate && !isSelected && !isFuture && styles.calTodayCell,
                ]}
                onPress={() => isInteractive && !isFuture && handleDateSelect(dayItem.date)}
                activeOpacity={isFuture ? 1 : 0.7}
                disabled={isFuture || !isInteractive}
              >
                <Text
                  style={[
                    styles.calDateText,
                    isTodayDate && !isSelected && !isFuture && styles.calTodayText,
                    isSelected && styles.calSelectedText,
                    isFuture && styles.calFutureText,
                  ]}
                >
                  {dayItem.day}
                </Text>
                {isLogged && (
                  <View style={styles.calIndicatorLeft} pointerEvents="none">
                    <Ionicons name="checkmark" size={10} color={isSelected ? colors.primary : 'rgba(255,255,255,0.9)'} />
                  </View>
                )}
                {hasSleep && (
                  <Text style={[styles.calZzz, isSelected && styles.calZzzSelected]} pointerEvents="none">Zzz</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const DAY_CELL_SIZE = 36;
const DAY_CELL_PADDING = 4;
const DAY_CELL_BORDER_RADIUS = 8;
const CALENDAR_CELL_PADDING_V = 6;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.regular,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  headerContent: {
    paddingBottom: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  leftSlot: {
    minWidth: 72,
    alignItems: 'flex-start',
  },
  rightSlot: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  todayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  todayButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  dateChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
  },
  dateChipText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: DAY_CELL_PADDING / 2,
    paddingVertical: DAY_CELL_PADDING / 2,
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: DAY_CELL_PADDING / 2,
  },
  dragHandleBarWrap: {
    alignSelf: 'stretch',
    minHeight: HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  stripDayName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  stripDayNameSelected: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  datePill: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_BORDER_RADIUS,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  datePillSelected: {
    backgroundColor: colors.white,
    borderWidth: 0,
  },
  datePillIndicatorLeft: {
    position: 'absolute',
    bottom: 2,
    left: 2,
  },
  datePillZzz: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  datePillZzzSelected: {
    color: colors.primary,
  },
  datePillNumber: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  datePillNumberSelected: {
    color: colors.primary,
  },
  // Expanded calendar — only as tall as month + day names + grid + handle
  calendarWrap: {
    marginHorizontal: -spacing.regular,
    paddingHorizontal: spacing.regular,
    paddingTop: 0,
    paddingBottom: 0,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingVertical: 0,
    minHeight: 28,
  },
  calendarHeaderTitleOnly: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minHeight: 28,
  },
  calendarPanel: {
    flex: 0,
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
  calZzz: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  calZzzSelected: {
    color: colors.primary,
  },
  calDateText: {
    fontSize: typography.sizes.small,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.weights.medium,
  },
  calTodayCell: {
    borderWidth: 2,
    borderColor: colors.white,
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
});

export default DateHeader;
