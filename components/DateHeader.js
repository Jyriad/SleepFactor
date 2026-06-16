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
import habitLoggedDatesService from '../services/habitLoggedDatesService';
import { subscribeDateStripLoggedRefresh } from '../services/dateStripBadgeRefresh';
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
const HANDLE_HEIGHT = 12;
const STRIP_ROW_HEIGHT = 50;
const STRIP_LABEL_HEIGHT = 16;
/** Strip (7-day row + label) lives inside the drawer. Collapsed = label + strip + handle so no layout jump on close. */
const COLLAPSED_DRAWER_HEIGHT = STRIP_LABEL_HEIGHT + STRIP_ROW_HEIGHT + HANDLE_HEIGHT;
const CLOSE_ANIMATION_DURATION_MS = 220;
const DAY_CELL_SIZE = 34;
const DAY_CELL_PADDING = 3;
const DAY_CELL_BORDER_RADIUS = 8;

const CALENDAR_HEADER_H = 28;
const CALENDAR_DAY_NAMES_H = 16;
const CALENDAR_ROW_H = 36 + 12;
const CALENDAR_ROWS = 6;
const CALENDAR_CONTENT_HEIGHT =
  CALENDAR_HEADER_H + CALENDAR_DAY_NAMES_H + CALENDAR_ROWS * CALENDAR_ROW_H + 24;
const EXPANDED_DRAWER_HEIGHT = COLLAPSED_DRAWER_HEIGHT + CALENDAR_CONTENT_HEIGHT;

const SPRING_CONFIG = { damping: 24, stiffness: 280 };

const TOP_ROW_HEIGHT_FALLBACK = 48;

/** Calendar shows a month grid; keep it on “now” whenever the strip’s day is stuck in an earlier calendar month (e.g. April selected, real-world May). */
function calendarMonthAnchorForSelection(selectedDayKey, todayDayKey) {
  const todayMonthKey = todayDayKey.slice(0, 7);
  if (!selectedDayKey) return new Date(`${todayMonthKey}-01T12:00:00`);
  const selMonthKey = selectedDayKey.slice(0, 7);
  if (selMonthKey < todayMonthKey) return new Date(`${todayMonthKey}-01T12:00:00`);
  return new Date(selectedDayKey + 'T12:00:00');
}

const DateHeader = ({
  selectedDate,
  onDateChange,
  leftElement = null,
  rightElement = null,
  showTodayButton = true,
  todayButtonSide = 'left',
  /** Bumped when device sleep sync saves new rows so the strip re-queries local sleep (bed icons). */
  sleepStripRefreshKey = 0,
  onExpandChange,
  /**
   * Collapsed chrome height (top row + strip + handle) for scroll padding under overlay headers.
   * Always reports collapsed height so the calendar drawer expands over content instead of pushing it.
   */
  onChromeHeightChange,
  /** Light frosted header: dark text/icons (pair with GlassChromeBar) */
  glass = false,
}) => {
  const [stripSleepDates, setStripSleepDates] = useState([]);
  const [stripLoggedDates, setStripLoggedDates] = useState([]);
  const [habitStripRefreshKey, setHabitStripRefreshKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [topRowHeight, setTopRowHeight] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const todayKey = getToday();
    const sel =
      selectedDate != null ? formatDateForDB(selectedDate) : null;
    return calendarMonthAnchorForSelection(sel, todayKey);
  });

  const expandHeight = useSharedValue(COLLAPSED_DRAWER_HEIGHT);
  const startHeight = useSharedValue(COLLAPSED_DRAWER_HEIGHT);

  const selectedDateStr =
    typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate);
  /** Stable YYYY-MM-DD so browsing months by swipe isn’t undone when parents pass a fresh Date reference. */
  const selectedCalendarDayKey =
    selectedDate != null ? formatDateForDB(selectedDate) : null;
  const todayStr = getToday();
  const stripCenterDate = selectedDate
    ? (typeof selectedDate === 'string' ? new Date(selectedDate + 'T12:00:00') : selectedDate)
    : new Date();
  const stripDates =
    isWithinLast7Days(stripCenterDate)
      ? getDateStripArrayLast7Days()
      : getDateStripArrayCentered(stripCenterDate, STRIP_DAYS);
  /** Stable bounds id so we only trim/refetch sleep strip state when the visible week actually changes. */
  const stripRangeKey =
    stripDates.length > 0
      ? `${stripDates[0].date}:${stripDates[stripDates.length - 1].date}`
      : '';
  const stripLabel = (() => {
    if (isWithinLast7Days(stripCenterDate)) return 'This week';
    if (stripDates.length === 0) return 'This week';
    const start = stripDates[0].date;
    const end = stripDates[stripDates.length - 1].date;
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    const sm = s.toLocaleDateString('en-US', { month: 'short' });
    const em = e.toLocaleDateString('en-US', { month: 'short' });
    const sd = s.getDate();
    const ed = e.getDate();
    if (sm === em) return `${sm} ${sd}–${ed}`;
    return `${sm} ${sd} – ${em} ${ed}`;
  })();
  const displayTitle = formatDateTitle(selectedDate);
  const showToday = showTodayButton && displayTitle !== 'Today';
  const showTodayOnRight = showToday && todayButtonSide === 'right';
  const showTodayOnLeft = showToday && !showTodayOnRight;

  /**
   * When collapsed, align the carousel month with the strip’s day—but never leave the calendar
   * stuck in a past month once real-world dates have moved on (handles reload + reopen reliably).
   * While expanded, swiping owns `currentMonth` until the user collapses again.
   */
  useEffect(() => {
    if (isExpanded) return;
    setCurrentMonth(calendarMonthAnchorForSelection(selectedCalendarDayKey, todayStr));
  }, [isExpanded, selectedCalendarDayKey, todayStr]);

  useEffect(() => subscribeDateStripLoggedRefresh(() => {
    setHabitStripRefreshKey((key) => key + 1);
  }), []);

  /** Keep strip badges for days still visible when the week window changes; avoids a blank flash until the new range fetch returns. */
  useEffect(() => {
    if (!stripRangeKey) return;
    const allowed = new Set(stripDates.map((x) => x.date));
    setStripSleepDates((prev) => prev.filter((d) => allowed.has(d)));
    setStripLoggedDates((prev) => prev.filter((d) => allowed.has(d)));
  }, [stripRangeKey]);

  useEffect(() => {
    if (stripDates.length === 0) return;
    const start = stripDates[0].date;
    const end = stripDates[stripDates.length - 1].date;
    let cancelled = false;
    const sleepOpts = { cacheNonce: sleepStripRefreshKey };
    const habitOpts = { cacheNonce: habitStripRefreshKey };

    sleepDataService
      .fetchVisibleSleepDatesForStrip(start, end, sleepOpts)
      .then((dates) => {
        if (cancelled) return;
        setStripSleepDates(Array.isArray(dates) ? dates : []);
      })
      .catch(() => {
        if (cancelled) return;
        sleepDataService
          .getSleepDataForRange(start, end, sleepOpts)
          .then((data) => {
            if (cancelled) return;
            setStripSleepDates((data || []).map((r) => r.date));
          })
          .catch(() => {});
      });

    habitLoggedDatesService
      .fetchVisibleLoggedDatesForStrip(start, end, habitOpts)
      .then((dates) => {
        if (cancelled) return;
        setStripLoggedDates(Array.isArray(dates) ? dates : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.log('[DateHeader] habit strip logged dates fetch failed:', err?.message || err);
        setStripLoggedDates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    stripDates[0]?.date,
    stripDates[stripDates.length - 1]?.date,
    sleepStripRefreshKey,
    habitStripRefreshKey,
  ]);

  const handleTodayPress = () => {
    onDateChange(new Date(todayStr + 'T12:00:00'));
  };

  const todayButtonElement = (
    <TouchableOpacity
      onPress={handleTodayPress}
      style={[styles.todayButton, leftElement != null && !showTodayOnRight && styles.todayButtonBesideBack]}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-undo-outline" size={16} color={colors.primary} style={styles.todayButtonIcon} />
      <Text style={styles.todayButtonText}>Today</Text>
    </TouchableOpacity>
  );

  const notifyOpened = useCallback(() => {
    setIsExpanded(true);
    onExpandChange?.(true);
  }, [onExpandChange]);

  const notifyClosed = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
  }, [onExpandChange]);

  const reportChromeHeight = useCallback(() => {
    if (!onChromeHeightChange) return;
    const row = topRowHeight > 0 ? topRowHeight : TOP_ROW_HEIGHT_FALLBACK;
    onChromeHeightChange(row + COLLAPSED_DRAWER_HEIGHT);
  }, [topRowHeight, onChromeHeightChange]);

  useEffect(() => {
    reportChromeHeight();
  }, [reportChromeHeight]);

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

  /** Lower = vertical pan claims the gesture sooner (less “dead” movement before drag). */
  const VERTICAL_PAN_ACTIVATE_PX = 8;
  const DRAWER_RANGE = EXPANDED_DRAWER_HEIGHT - COLLAPSED_DRAWER_HEIGHT;
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
      const startH = startHeight.value;
      const openFraction = (current - COLLAPSED_DRAWER_HEIGHT) / DRAWER_RANGE;
      const startedExpanded = startH > COLLAPSED_DRAWER_HEIGHT + DRAWER_RANGE * 0.55;

      if (startedExpanded) {
        // Closing: short swipe up or modest drag down should collapse (opening used one threshold for both).
        const shouldClose =
          vy < -95 || ty < -32 || openFraction < 0.62;
        if (shouldClose) {
          expandHeight.value = withTiming(COLLAPSED_DRAWER_HEIGHT, {
            duration: CLOSE_ANIMATION_DURATION_MS,
          });
          runOnJS(notifyClosed)();
        } else {
          expandHeight.value = withSpring(EXPANDED_DRAWER_HEIGHT, SPRING_CONFIG);
          runOnJS(notifyOpened)();
        }
      } else {
        const threshold = COLLAPSED_DRAWER_HEIGHT + DRAWER_RANGE * 0.4;
        const shouldOpen =
          vy > 150 || (ty > 20 && current > threshold) || openFraction > 0.5;
        if (shouldOpen) {
          expandHeight.value = withSpring(EXPANDED_DRAWER_HEIGHT, SPRING_CONFIG);
          runOnJS(notifyOpened)();
        } else {
          expandHeight.value = withTiming(COLLAPSED_DRAWER_HEIGHT, {
            duration: CLOSE_ANIMATION_DURATION_MS,
          });
          runOnJS(notifyClosed)();
        }
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
          <View
            style={styles.topRow}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setTopRowHeight(h);
            }}
          >
          <View style={styles.leftSlot}>
            {(leftElement != null || showTodayOnLeft) && (
              <View style={styles.leftSlotInner}>
                {leftElement}
                {showTodayOnLeft ? todayButtonElement : null}
              </View>
            )}
          </View>
          <View style={styles.dateChip}>
            <Text
              style={glass ? styles.dateChipTextGlass : styles.dateChipText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayTitle}
            </Text>
          </View>
          <View style={styles.rightSlot}>
            {(rightElement != null || showTodayOnRight) && (
              <View style={styles.rightSlotInner}>
                {rightElement}
                {showTodayOnRight ? todayButtonElement : null}
              </View>
            )}
          </View>
        </View>

        <Animated.View style={[styles.drawer, drawerAnimatedStyle]}>
          <View style={styles.stripSection}>
            <Text style={glass ? styles.stripSectionLabelGlass : styles.stripSectionLabel}>{stripLabel}</Text>
            <View style={styles.stripRow}>
              {stripDates.map((dateItem) => {
                const isSelected = dateItem.date === selectedDateStr;
                const isLogged = stripLoggedDates.includes(dateItem.date);
                const hasSleep = stripSleepDates.includes(dateItem.date);
                const stripDayStatus =
                  isLogged && hasSleep ? 'complete' : isLogged || hasSleep ? 'partial' : 'empty';
                return (
                  <TouchableOpacity
                    key={dateItem.date}
                    style={styles.stripItem}
                    onPress={() => onDateChange(new Date(dateItem.date + 'T12:00:00'))}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        glass ? styles.stripDayNameGlass : styles.stripDayName,
                        isSelected &&
                          (glass ? styles.stripDayNameSelectedGlass : styles.stripDayNameSelected),
                      ]}
                    >
                      {dateItem.dayName}
                    </Text>
                    <View
                      style={[
                        glass ? styles.datePillGlass : styles.datePill,
                        !isSelected && stripDayStatus === 'partial' &&
                          (glass ? styles.datePillGlassStatusPartial : styles.datePillStatusPartial),
                        !isSelected && stripDayStatus === 'complete' &&
                          (glass ? styles.datePillGlassStatusComplete : styles.datePillStatusComplete),
                        isSelected && (glass ? styles.datePillSelectedGlass : styles.datePillSelected),
                        isSelected &&
                          stripDayStatus === 'partial' &&
                          (glass ? styles.datePillSelectedGlassPartial : styles.datePillSelectedPartial),
                        isSelected &&
                          stripDayStatus === 'complete' &&
                          (glass ? styles.datePillSelectedGlassComplete : styles.datePillSelectedComplete),
                        isSelected && styles.datePillToday,
                      ]}
                    >
                      <Text
                        style={[
                          glass ? styles.datePillNumberGlass : styles.datePillNumber,
                          isSelected && styles.datePillNumberSelected,
                        ]}
                      >
                        {dateItem.dayNumber}
                      </Text>
                      {isLogged && (
                        <View style={styles.datePillIndicatorLeft} pointerEvents="none">
                          <Ionicons
                            name="checkmark"
                            size={10}
                            color={
                              isSelected
                                ? colors.primary
                                : glass
                                  ? colors.textSecondary
                                  : 'rgba(255,255,255,0.9)'
                            }
                          />
                        </View>
                      )}
                      {hasSleep && (
                        <View style={styles.datePillSleepIcon} pointerEvents="none">
                          <Ionicons
                            name="bed-outline"
                            size={10}
                            color={
                              isSelected
                                ? colors.primary
                                : glass
                                  ? colors.textSecondary
                                  : 'rgba(255, 255, 255, 0.9)'
                            }
                          />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Animated.View style={[styles.calendarWrap, calendarWrapStyle]}>
            <DatePickerCalendar
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              selectedDateStr={selectedDateStr}
              onDateSelect={handleDateSelectFromCalendar}
              glass={glass}
            />
          </Animated.View>
          <GestureDetector gesture={composedHandleGesture}>
            <View style={styles.dragHandleBarWrap}>
              <View style={glass ? styles.dragHandleBarGlass : styles.dragHandleBar} />
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
  },
  leftSlot: {
    minWidth: 72,
    maxWidth: '46%',
    alignItems: 'flex-start',
  },
  leftSlotInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
  },
  rightSlot: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  rightSlotInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    flexShrink: 0,
  },
  todayButtonBesideBack: {
    paddingHorizontal: spacing.xs,
  },
  todayButtonIcon: {
    marginRight: spacing.xs,
  },
  todayButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  dateChip: {
    flex: 1,
    minWidth: 0,
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
    marginBottom: 0,
    paddingHorizontal: DAY_CELL_PADDING / 2,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: DAY_CELL_PADDING / 2,
    paddingTop: 2,
    paddingBottom: 2,
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
    paddingVertical: 2,
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
    marginBottom: 2,
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
  /** Sleep or habits logged, but not both — soft accent tint */
  datePillStatusPartial: {
    backgroundColor: 'rgba(176, 205, 235, 0.48)',
  },
  /** Sleep synced and habits logged — soft success tint */
  datePillStatusComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.42)',
  },
  datePillSelected: {
    backgroundColor: colors.white,
    borderWidth: 0,
  },
  datePillSelectedPartial: {
    backgroundColor: '#E8F4FC',
  },
  datePillSelectedComplete: {
    backgroundColor: '#ECFDF5',
  },
  datePillToday: {
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },
  datePillIndicatorLeft: {
    position: 'absolute',
    bottom: 2,
    left: 2,
  },
  datePillSleepIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  datePillNumber: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  datePillNumberSelected: {
    color: colors.primary,
  },
  dateChipTextGlass: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  stripSectionLabelGlass: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 0,
    paddingHorizontal: DAY_CELL_PADDING / 2,
  },
  stripDayNameGlass: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  stripDayNameSelectedGlass: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  datePillGlass: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_BORDER_RADIUS,
    backgroundColor: 'rgba(17, 41, 75, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  datePillGlassStatusPartial: {
    backgroundColor: 'rgba(36, 105, 178, 0.16)',
  },
  datePillGlassStatusComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  datePillSelectedGlass: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datePillSelectedGlassPartial: {
    backgroundColor: '#E8F4FC',
  },
  datePillSelectedGlassComplete: {
    backgroundColor: '#ECFDF5',
  },
  datePillNumberGlass: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dragHandleBarGlass: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(17, 41, 75, 0.35)',
  },
});

export default DateHeader;
