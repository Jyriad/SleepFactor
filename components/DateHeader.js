import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  UIManager,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import sleepDataService from '../services/sleepDataService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  formatDateForDB,
  formatDateTitle,
  getDateStripArrayCentered,
  getDateStripArrayLast7Days,
  getToday,
  isWithinLast7Days,
} from '../utils/dateHelpers';
import DatePickerCalendar from './DatePickerCalendar';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STRIP_DAYS = 7;
const HANDLE_HEIGHT = 14;
const STRIP_ROW_HEIGHT = 58;
const STRIP_LABEL_HEIGHT = 20;
/** Strip (7-day row + label) lives inside the drawer. Collapsed = label + strip + handle so no layout jump on close. */
const COLLAPSED_DRAWER_HEIGHT = STRIP_LABEL_HEIGHT + STRIP_ROW_HEIGHT + HANDLE_HEIGHT;
const CLOSE_ANIMATION_DURATION_MS = 220;
const TOP_ROW_HEIGHT = 36;
const DAY_CELL_SIZE = 36;
const DAY_CELL_PADDING = 4;
const DAY_CELL_BORDER_RADIUS = 8;

const CALENDAR_HEADER_H = 28;
const CALENDAR_DAY_NAMES_H = 16;
const CALENDAR_ROW_H = 36 + 12;
const CALENDAR_ROWS = 6;
const CALENDAR_CONTENT_HEIGHT =
  CALENDAR_HEADER_H + CALENDAR_DAY_NAMES_H + CALENDAR_ROWS * CALENDAR_ROW_H + 24;
const EXPANDED_DRAWER_HEIGHT = COLLAPSED_DRAWER_HEIGHT + CALENDAR_CONTENT_HEIGHT;

const SPRING_CONFIG = { damping: 24, stiffness: 280 };

const DateHeader = ({
  selectedDate,
  onDateChange,
  loggedDates = [],
  leftElement = null,
  rightElement = null,
  showTodayButton = true,
  onExpandChange,
}) => {
  const [stripSleepDates, setStripSleepDates] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() =>
    selectedDate ? new Date(selectedDate) : new Date()
  );

  const expandHeight = useSharedValue(COLLAPSED_DRAWER_HEIGHT);
  const startHeight = useSharedValue(COLLAPSED_DRAWER_HEIGHT);

  const selectedDateStr =
    typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate);
  const todayStr = getToday();
  const stripCenterDate = selectedDate
    ? (typeof selectedDate === 'string' ? new Date(selectedDate + 'T12:00:00') : selectedDate)
    : new Date();
  const stripDates =
    isWithinLast7Days(stripCenterDate)
      ? getDateStripArrayLast7Days()
      : getDateStripArrayCentered(stripCenterDate, STRIP_DAYS);
  const displayTitle = formatDateTitle(selectedDate);
  const showToday = showTodayButton && displayTitle !== 'Today';

  useEffect(() => {
    if (selectedDate) setCurrentMonth(new Date(selectedDate));
  }, [selectedDate]);

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
    onDateChange(new Date(todayStr + 'T12:00:00'));
  };

  const notifyOpened = useCallback(() => {
    setIsExpanded(true);
    onExpandChange?.(true);
  }, [onExpandChange]);

  const notifyClosed = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
  }, [onExpandChange]);

  const openDrawer = useCallback(() => {
    expandHeight.value = withSpring(EXPANDED_DRAWER_HEIGHT, SPRING_CONFIG);
    notifyOpened();
  }, [notifyOpened]);

  const closeDrawer = useCallback(() => {
    notifyClosed();
    expandHeight.value = withTiming(COLLAPSED_DRAWER_HEIGHT, { duration: CLOSE_ANIMATION_DURATION_MS });
  }, [notifyClosed]);

  const handleDateSelectFromCalendar = useCallback(
    (dateStr) => {
      onDateChange(new Date(dateStr + 'T12:00:00'));
      closeDrawer();
    },
    [onDateChange, closeDrawer]
  );

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    const today = new Date();
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + 1);
      const canForward =
        next.getFullYear() < today.getFullYear() ||
        (next.getFullYear() === today.getFullYear() &&
          next.getMonth() <= today.getMonth());
      return canForward ? next : prev;
    });
  }, []);

  const VERTICAL_PAN_ACTIVATE_PX = 14;
  const verticalPanGesture = Gesture.Pan()
    .activeOffsetY([-VERTICAL_PAN_ACTIVATE_PX, VERTICAL_PAN_ACTIVATE_PX])
    .onStart(() => {
      startHeight.value = expandHeight.value;
    })
    .onUpdate((e) => {
      const next = startHeight.value + e.translationY;
      expandHeight.value = Math.max(
        COLLAPSED_DRAWER_HEIGHT,
        Math.min(EXPANDED_DRAWER_HEIGHT, next)
      );
    })
    .onEnd((e) => {
      const ty = e.translationY;
      const vy = e.velocityY;
      const current = expandHeight.value;
      const threshold = EXPANDED_DRAWER_HEIGHT * 0.4;
      const shouldOpen =
        vy > 150 || (ty > 20 && current > threshold) || current > EXPANDED_DRAWER_HEIGHT * 0.5;
      if (shouldOpen) {
        expandHeight.value = withSpring(EXPANDED_DRAWER_HEIGHT, SPRING_CONFIG);
        runOnJS(notifyOpened)();
      } else {
        expandHeight.value = withTiming(COLLAPSED_DRAWER_HEIGHT, { duration: CLOSE_ANIMATION_DURATION_MS });
        runOnJS(notifyClosed)();
      }
    });

  const handleTapGesture = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      if (expandHeight.value > COLLAPSED_DRAWER_HEIGHT + 20) {
        expandHeight.value = withTiming(COLLAPSED_DRAWER_HEIGHT, { duration: CLOSE_ANIMATION_DURATION_MS });
        runOnJS(notifyClosed)();
      } else {
        expandHeight.value = withSpring(EXPANDED_DRAWER_HEIGHT, SPRING_CONFIG);
        runOnJS(notifyOpened)();
      }
    });

  const composedHandleGesture = handleTapGesture;

  const HORIZONTAL_PAN_ACTIVATE_PX = 24;
  const SWIPE_THRESHOLD_PX = 40;
  const horizontalMonthPanGesture = Gesture.Pan()
    .activeOffsetX([-HORIZONTAL_PAN_ACTIVATE_PX, HORIZONTAL_PAN_ACTIVATE_PX])
    .onEnd((e) => {
      const tx = e.translationX;
      const vx = e.velocityX;
      if (tx > SWIPE_THRESHOLD_PX || vx > 300) {
        runOnJS(goToPrevMonth)();
      } else if (tx < -SWIPE_THRESHOLD_PX || vx < -300) {
        runOnJS(goToNextMonth)();
      }
    });

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    height: expandHeight.value,
    overflow: 'hidden',
  }));

  const calendarWrapStyle = useAnimatedStyle(() => ({
    height: Math.max(0, expandHeight.value - COLLAPSED_DRAWER_HEIGHT),
    overflow: 'hidden',
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={verticalPanGesture}>
        <View style={styles.headerContent}>
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
                <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} style={styles.todayButtonIcon} />
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{displayTitle}</Text>
          </View>
          <View style={styles.rightSlot}>{rightElement}</View>
        </View>

        <Animated.View style={[styles.drawer, drawerAnimatedStyle]}>
          <View style={styles.stripSection}>
            <Text style={styles.stripSectionLabel}>This week</Text>
            <View style={styles.stripRow}>
              {stripDates.map((dateItem) => {
                const isSelected = dateItem.date === selectedDateStr;
                const isToday = dateItem.date === todayStr;
                const isLogged = loggedDates.includes(dateItem.date);
                const hasSleep = stripSleepDates.includes(dateItem.date);
                return (
                  <TouchableOpacity
                    key={dateItem.date}
                    style={styles.stripItem}
                    onPress={() => onDateChange(new Date(dateItem.date + 'T12:00:00'))}
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
                        isToday && styles.datePillToday,
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
            </View>
          </View>
          <GestureDetector gesture={horizontalMonthPanGesture}>
            <Animated.View style={[styles.calendarWrap, calendarWrapStyle]}>
              <DatePickerCalendar
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedDateStr={selectedDateStr}
                onDateSelect={handleDateSelectFromCalendar}
              />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={composedHandleGesture}>
            <View style={styles.dragHandleBarWrap}>
              <View style={styles.dragHandleBar} />
            </View>
          </GestureDetector>
        </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.regular,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    marginBottom: 0,
    overflow: 'hidden',
  },
  headerContent: {
    position: 'relative',
    paddingBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    minHeight: TOP_ROW_HEIGHT,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  todayButtonIcon: {
    marginRight: spacing.xs,
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
  stripSection: {
    minHeight: STRIP_LABEL_HEIGHT + STRIP_ROW_HEIGHT,
  },
  stripSectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 2,
    paddingHorizontal: DAY_CELL_PADDING / 2,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: DAY_CELL_PADDING / 2,
    paddingTop: 4,
    paddingBottom: DAY_CELL_PADDING / 2,
    minHeight: STRIP_ROW_HEIGHT,
  },
  stripItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: DAY_CELL_PADDING / 2,
  },
  drawer: {
    overflow: 'hidden',
  },
  calendarWrap: {
    overflow: 'hidden',
  },
  dragHandleBarWrap: {
    alignSelf: 'stretch',
    minHeight: HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dragHandleBar: {
    width: 36,
    height: 3,
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
  datePillToday: {
    borderWidth: 2,
    borderColor: colors.accent,
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
});

export default DateHeader;
