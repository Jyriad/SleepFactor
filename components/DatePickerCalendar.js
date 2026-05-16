import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
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

/** Match `DateHeader` `CALENDAR_HEADER_H` / month row. */
const CALENDAR_HEADER_ROW_H = 28;
/** Match `DateHeader` `CALENDAR_DAY_NAMES_H` so expanded drawer height stays consistent. */
const CALENDAR_DAY_NAMES_ROW_H = 16;
/** Row ≈ cell + vertical padding (`DateHeader` uses 36+12 for row height budget). */
const CALENDAR_PAGE_ROW_HEIGHT = DAY_CELL_SIZE + CALENDAR_CELL_PADDING_V * 2;
/** Match `DateHeader` `CALENDAR_CONTENT` trailing inset so drawer height stays aligned. */
const CALENDAR_PAGE_BOTTOM_SLACK = 24;
/** Week labels + 6 grid rows + slack (everything below the month title inside each page). */
const CALENDAR_PAGE_GRID_BLOCK_HEIGHT =
  CALENDAR_DAY_NAMES_ROW_H + 6 * CALENDAR_PAGE_ROW_HEIGHT + CALENDAR_PAGE_BOTTOM_SLACK;
/** One carousel page: month header row + grid block (title scrolls with the dates). */
const CAROUSEL_PAGE_HEIGHT = CALENDAR_HEADER_ROW_H + CALENDAR_PAGE_GRID_BLOCK_HEIGHT;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Survives carousel page remounts so month swipe doesn’t briefly clear badges/colours before queries finish. */
const calendarMonthBadgeCache = new Map();

function badgeCacheKey(userId, monthAnchor) {
  return `${userId}:${monthKey(monthAnchor)}`;
}

const isAutomatedBedtimeHabit = (habit) =>
  habit && habit.name === 'Bedtime Consistency';

function monthKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function addCalendarMonth(base, delta) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function canNavigateForwardFromMonth(monthDate) {
  const todayDate = new Date();
  return (
    monthDate.getFullYear() < todayDate.getFullYear() ||
    (monthDate.getFullYear() === todayDate.getFullYear() &&
      monthDate.getMonth() < todayDate.getMonth())
  );
}

/** Which paging column the scroll offset is closest to (0 = left, 1 = center, …). */
function nearestPageSnapIndex(scrollX, pageWidth, pageCount) {
  const w = pageWidth;
  if (w <= 0) return 1;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < pageCount; i++) {
    const snap = i * w;
    const d = Math.abs(scrollX - snap);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

function CalendarPageHeader({ monthAnchor, glass, onPrevPress, onNextPress }) {
  const monthName = monthAnchor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const canFwd = canNavigateForwardFromMonth(monthAnchor);
  const monthTextStyle = glass ? styles.calMonthTextGlass : styles.calMonthText;
  const navBack = glass ? colors.textPrimary : colors.white;
  const navFwd = canFwd
    ? glass
      ? colors.textPrimary
      : colors.white
    : glass
      ? colors.textLight
      : 'rgba(255,255,255,0.4)';

  return (
    <View style={styles.calendarHeader}>
      <TouchableOpacity onPress={onPrevPress} style={styles.calNavBtn}>
        <Ionicons name="chevron-back" size={24} color={navBack} />
      </TouchableOpacity>
      <Text style={[monthTextStyle, styles.calendarHeaderMonthText]} numberOfLines={1}>
        {monthName}
      </Text>
      <TouchableOpacity onPress={onNextPress} style={styles.calNavBtn} disabled={!canFwd}>
        <Ionicons name="chevron-forward" size={24} color={navFwd} />
      </TouchableOpacity>
    </View>
  );
}

/** Single month grid (week labels + cells); fetches badges for that month only. */
function CalendarMonthGrid({ monthAnchor, selectedDateStr, onDateSelect, glass, pageWidth }) {
  const { user } = useAuth();
  const cacheKey = user ? badgeCacheKey(user.id, monthAnchor) : null;
  const cachedBadges = cacheKey ? calendarMonthBadgeCache.get(cacheKey) : null;
  const [calendarLoggedDates, setCalendarLoggedDates] = useState(
    () => cachedBadges?.logged ?? []
  );
  const [calendarSleepDataDates, setCalendarSleepDataDates] = useState(
    () => cachedBadges?.sleep ?? []
  );

  useEffect(() => {
    if (!user) return;
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = formatDateForDB(firstDay);
    const endDate = formatDateForDB(lastDay);

    const loggedSet = new Set();
    let cancelled = false;
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
    ]).then(() => {
      if (cancelled) return;
      const logged = Array.from(loggedSet);
      const ck = badgeCacheKey(user.id, monthAnchor);
      const prevEntry = calendarMonthBadgeCache.get(ck) ?? { logged: [], sleep: [] };
      calendarMonthBadgeCache.set(ck, { logged, sleep: prevEntry.sleep ?? [] });
      setCalendarLoggedDates(logged);
    });

    /** Same “visible sleep” rules as the week strip / dashboard (RPC), not exclude_from_insights-only rows. */
    sleepDataService
      .fetchVisibleSleepDatesForStrip(startDate, endDate)
      .then((stripDates) => {
        if (cancelled) return;
        const normalized = (Array.isArray(stripDates) ? stripDates : []).map((d) => formatDateForDB(d));
        const ck = badgeCacheKey(user.id, monthAnchor);
        const prevEntry = calendarMonthBadgeCache.get(ck) ?? { logged: [], sleep: [] };
        calendarMonthBadgeCache.set(ck, { logged: prevEntry.logged ?? [], sleep: normalized });
        setCalendarSleepDataDates(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        sleepDataService
          .getSleepDataForRange(startDate, endDate)
          .then((sleepData) => {
            if (cancelled) return;
            const normalized = (sleepData || []).map((r) => formatDateForDB(r.date));
            const ck = badgeCacheKey(user.id, monthAnchor);
            const prevEntry = calendarMonthBadgeCache.get(ck) ?? { logged: [], sleep: [] };
            calendarMonthBadgeCache.set(ck, { logged: prevEntry.logged ?? [], sleep: normalized });
            setCalendarSleepDataDates(normalized);
          })
          .catch(() => {
            if (cancelled) return;
          });
      });

    return () => {
      cancelled = true;
    };
  }, [user, monthKey(monthAnchor)]);

  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < startingDayOfWeek; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    cells.push({
      day,
      date: formatDateForDB(dateObj),
    });
  }

  const today = getToday();
  const handleDateSelectInner = (dateStr) => {
    if (dateStr && dateStr <= today) {
      onDateSelect(dateStr);
    }
  };

  const dayNameStyle = glass ? styles.dayNameTextGlass : styles.dayNameText;
  const iconMuted = glass ? colors.textSecondary : 'rgba(255,255,255,0.9)';

  const pageWrapStyle =
    pageWidth > 0 ? [styles.pagerPage, { width: pageWidth }] : styles.pagerPage;

  return (
    <View style={pageWrapStyle} collapsable={false}>
      <View style={styles.dayNamesRow}>
        {WEEKDAY_LABELS.map((dn) => (
          <View key={dn} style={styles.dayNameCellWrapper}>
            <Text style={dayNameStyle}>{dn}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((dayItem, index) => {
          if (!dayItem) {
            return <View key={`e-${index}`} style={styles.dateCellWrapper} />;
          }
          const isSelected = dayItem.date === selectedDateStr;
          const isLogged = calendarLoggedDates.includes(dayItem.date);
          const hasSleep = calendarSleepDataDates.includes(dayItem.date);
          const isTodayDate = dayItem.date === today;
          const isFuture = dayItem.date > today;
          const stripDayStatus =
            isLogged && hasSleep ? 'complete' : isLogged || hasSleep ? 'partial' : 'empty';

          const futureCell = glass ? styles.calFutureCellGlass : styles.calFutureCell;
          const baseCell = glass ? styles.calDateCellGlass : styles.calDateCell;

          const dateTextBase = glass ? styles.calDateTextGlass : styles.calDateText;
          const todayTextExtra =
            isTodayDate && !isSelected && !isFuture
              ? glass
                ? styles.calTodayTextGlass
                : styles.calTodayText
              : null;

          return (
            <View key={dayItem.date} style={styles.dateCellWrapper}>
              <TouchableOpacity
                style={[
                  baseCell,
                  isFuture && futureCell,
                  !isFuture &&
                    !isSelected &&
                    stripDayStatus === 'partial' &&
                    (glass ? styles.calGlassStatusPartial : styles.calStatusPartial),
                  !isFuture &&
                    !isSelected &&
                    stripDayStatus === 'complete' &&
                    (glass ? styles.calGlassStatusComplete : styles.calStatusComplete),
                  !isFuture && isSelected && styles.calSelectedCell,
                  !isFuture &&
                    isSelected &&
                    stripDayStatus === 'partial' &&
                    (glass ? styles.calSelectedGlassPartial : styles.calSelectedPartial),
                  !isFuture &&
                    isSelected &&
                    stripDayStatus === 'complete' &&
                    (glass ? styles.calSelectedGlassComplete : styles.calSelectedComplete),
                  isTodayDate && !isFuture && styles.calTodayCell,
                ]}
                onPress={() => !isFuture && handleDateSelectInner(dayItem.date)}
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

/**
 * Horizontal carousel without `react-native-pager-view`: that library’s Fabric view (`RNCViewPager`)
 * shows “Unimplemented component” when the native binary hasn’t linked that codegen surface (common
 * with New Architecture / stale dev builds). RN `ScrollView` + `pagingEnabled` matches this pattern.
 */
function MonthCarouselStrip({
  scrollRef,
  pagerWidth,
  stableCenterKey,
  prevM,
  nextM,
  threePages,
  currentMonth,
  selectedDateStr,
  onDateSelect,
  glass,
  onMomentumScrollEnd,
  onScrollBeginDrag,
  onPrevPress,
  onNextPress,
  lastScrollXRef,
  onMonthKeyRecenter,
}) {
  const prevStableCenterKeyRef = useRef(null);
  const prevThreePagesRef = useRef(null);
  const didPagerLayoutRef = useRef(false);

  const pages = useMemo(() => {
    const wStyle = [styles.carouselPage, { width: pagerWidth }];
    const prevPage = (
      <View key={`pg-${monthKey(prevM)}`} style={wStyle} collapsable={false}>
        <CalendarPageHeader
          monthAnchor={prevM}
          glass={glass}
          onPrevPress={onPrevPress}
          onNextPress={onNextPress}
        />
        <CalendarMonthGrid
          monthAnchor={prevM}
          selectedDateStr={selectedDateStr}
          onDateSelect={onDateSelect}
          glass={glass}
          pageWidth={pagerWidth}
        />
      </View>
    );
    const centerPage = (
      <View key={`cg-${stableCenterKey}`} style={wStyle} collapsable={false}>
        <CalendarPageHeader
          monthAnchor={currentMonth}
          glass={glass}
          onPrevPress={onPrevPress}
          onNextPress={onNextPress}
        />
        <CalendarMonthGrid
          monthAnchor={currentMonth}
          selectedDateStr={selectedDateStr}
          onDateSelect={onDateSelect}
          glass={glass}
          pageWidth={pagerWidth}
        />
      </View>
    );
    if (threePages) {
      const nextPage = (
        <View key={`ng-${monthKey(nextM)}`} style={wStyle} collapsable={false}>
          <CalendarPageHeader
            monthAnchor={nextM}
            glass={glass}
            onPrevPress={onPrevPress}
            onNextPress={onNextPress}
          />
          <CalendarMonthGrid
            monthAnchor={nextM}
            selectedDateStr={selectedDateStr}
            onDateSelect={onDateSelect}
            glass={glass}
            pageWidth={pagerWidth}
          />
        </View>
      );
      return [prevPage, centerPage, nextPage];
    }
    /**
     * Forward-capped: `[April][May]` left→past, right→current. Viewport snaps to **May** at x=w so
     * dragging **right** reveals April (matches “back in time”); can’t scroll past May (no June).
     */
    return [prevPage, centerPage];
  }, [
    pagerWidth,
    stableCenterKey,
    prevM,
    threePages,
    nextM,
    currentMonth,
    selectedDateStr,
    onDateSelect,
    glass,
    onPrevPress,
    onNextPress,
  ]);

  const pageCount = pages.length;
  /** Current month is always the page at x = w (3-up middle, 2-up right column). */
  const snapCenterX = pagerWidth;

  const applyProgrammaticSnap = useCallback(() => {
    if (!scrollRef.current || pagerWidth <= 0) return;
    scrollRef.current.scrollTo({ x: snapCenterX, animated: false });
    lastScrollXRef.current = snapCenterX;
  }, [snapCenterX, pagerWidth, scrollRef, lastScrollXRef]);

  useLayoutEffect(() => {
    if (!scrollRef.current || pagerWidth <= 0) return;

    const hadPriorCenterKey = prevStableCenterKeyRef.current != null;
    const centerKeyMoved =
      hadPriorCenterKey && prevStableCenterKeyRef.current !== stableCenterKey;

    const hadPriorTriple = prevThreePagesRef.current !== null;
    const layoutFlipped = hadPriorTriple && prevThreePagesRef.current !== threePages;

    const firstPagerLayoutPass = !didPagerLayoutRef.current;
    didPagerLayoutRef.current = true;
    prevStableCenterKeyRef.current = stableCenterKey;
    prevThreePagesRef.current = threePages;

    applyProgrammaticSnap();
    /** Non-animated `scrollTo` can land one frame late on RN / Fabric; tighten position after layout. */
    requestAnimationFrame(applyProgrammaticSnap);
    requestAnimationFrame(() => requestAnimationFrame(applyProgrammaticSnap));

    const shouldMuteGhostMomentum =
      firstPagerLayoutPass || centerKeyMoved || layoutFlipped;
    if (shouldMuteGhostMomentum) {
      onMonthKeyRecenter?.();
    }
  }, [
    pagerWidth,
    pageCount,
    stableCenterKey,
    snapCenterX,
    threePages,
    onMonthKeyRecenter,
    lastScrollXRef,
    applyProgrammaticSnap,
  ]);

  /** Prevent new object literal every render (can reset native scroll on iOS). */
  const iosContentOffsetInitial = useMemo(
    () =>
      Platform.OS === 'ios' && pagerWidth > 0
        ? { x: pagerWidth, y: 0 }
        : undefined,
    [pagerWidth, pageCount],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="fast"
      removeClippedSubviews={false}
      contentOffset={iosContentOffsetInitial}
      style={[styles.carouselScroll, { width: pagerWidth, height: CAROUSEL_PAGE_HEIGHT }]}
      contentContainerStyle={[styles.carouselContent, { width: pagerWidth * pageCount }]}
      onLayout={() => {
        if (!threePages) applyProgrammaticSnap();
      }}
      onContentSizeChange={() => threePages && applyProgrammaticSnap()}
      onScroll={(ev) => {
        lastScrollXRef.current = ev.nativeEvent.contentOffset.x;
      }}
      onScrollBeginDrag={onScrollBeginDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
    >
      {pages}
    </ScrollView>
  );
}

export default function DatePickerCalendar({
  currentMonth,
  setCurrentMonth,
  selectedDateStr,
  onDateSelect,
  /** Match DateHeader glass mode: dark text/icons on frosted background */
  glass = false,
}) {
  const scrollRef = useRef(null);
  /** Last horizontal offset (updated in `onScroll`); `onMomentumScrollEnd`’s `contentOffset` is often stale vs this. */
  const lastScrollXRef = useRef(0);
  /**
   * Timestamp of last `scrollTo(middle)` triggered by a *month change* (not first mount).
   * Stale momentum events right after that still report the old edge offset and would apply the
   * *new* triple’s left column (e.g. March) if we trusted them.
   */
  const monthKeyRecenteredAtRef = useRef(null);
  /** Only apply `onMomentumScrollEnd` month changes after a real finger drag or chevron (blocks mount ghosts). */
  const userDraggedHorizontalRef = useRef(false);
  const chevronArmedMomentumRef = useRef(false);

  const pagerWidthRef = useRef(0);
  const layoutRef = useRef({
    prevM: null,
    nextM: null,
    threePages: true,
  });

  const [pagerWidth, setPagerWidth] = useState(0);
  pagerWidthRef.current = pagerWidth;

  const onPagerContainerLayout = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w <= 0) return;
    setPagerWidth((prev) => (w !== prev ? w : prev));
  }, []);

  const canGoNextFromCenter = canNavigateForwardFromMonth(currentMonth);
  const prevM = addCalendarMonth(currentMonth, -1);
  const nextM = canGoNextFromCenter ? addCalendarMonth(currentMonth, 1) : null;
  const threePages = nextM !== null;

  layoutRef.current = {
    prevM,
    nextM,
    threePages,
  };

  const stableCenterKey = monthKey(currentMonth);

  const onMonthKeyRecenter = useCallback(() => {
    monthKeyRecenteredAtRef.current = Date.now();
  }, []);

  /** Ignore ghost momentum callbacks after programmatic `scrollTo` (includes new strip mount 2⇄3 cols). */
  const MOMENTUM_IGNORE_AFTER_KEY_RECENTER_MS = 420;

  const handleMomentumScrollEnd = useCallback((ev) => {
    const w = pagerWidthRef.current;
    if (w <= 0) return;

    const mayApplyMomentum =
      userDraggedHorizontalRef.current || chevronArmedMomentumRef.current;

    if (!mayApplyMomentum) {
      return;
    }

    userDraggedHorizontalRef.current = false;
    chevronArmedMomentumRef.current = false;

    const tp = layoutRef.current.threePages;
    const pageCount = tp ? 3 : 2;

    const offsetX = ev?.nativeEvent?.contentOffset?.x;

    requestAnimationFrame(() => {
      const t0 = monthKeyRecenteredAtRef.current;
      if (t0 != null && Date.now() - t0 < MOMENTUM_IGNORE_AFTER_KEY_RECENTER_MS) {
        return;
      }

      let x =
        typeof offsetX === 'number' && Number.isFinite(offsetX)
          ? offsetX
          : lastScrollXRef.current;
      if (typeof x === 'number' && Number.isFinite(x)) {
        lastScrollXRef.current = x;
      }

      const idx = nearestPageSnapIndex(x, w, pageCount);

      const { prevM: p, nextM: n } = layoutRef.current;

      /** 2-up `[April][May]`: idx 0 = past, idx 1 = current (May). */
      if (!tp && pageCount === 2) {
        if (idx === 1) return;
        if (idx === 0 && p) {
          setCurrentMonth(new Date(p.getTime()));
        }
        return;
      }

      /** 3-up: idx 1 = current. */
      if (idx === 1) return;

      if (idx === 0 && p) {
        setCurrentMonth(new Date(p.getTime()));
      } else if (tp && idx === 2 && n) {
        setCurrentMonth(new Date(n.getTime()));
      }
    });
  }, [setCurrentMonth]);

  const handleScrollBeginDrag = useCallback(() => {
    userDraggedHorizontalRef.current = true;
  }, []);

  const goPagerPrev = useCallback(() => {
    const w = pagerWidthRef.current;
    if (w <= 0) return;
    chevronArmedMomentumRef.current = true;
    /** Left column is always one month older (works for 3-up and 2-up `[Apr][May]`). */
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, []);

  const goPagerNext = useCallback(() => {
    if (!layoutRef.current.threePages || pagerWidth <= 0) return;
    chevronArmedMomentumRef.current = true;
    scrollRef.current?.scrollTo({ x: pagerWidth * 2, animated: true });
  }, [pagerWidth]);

  return (
    <View style={styles.calendarWrap}>
      <View style={styles.pagerMeasuredHost} onLayout={onPagerContainerLayout}>
        {pagerWidth > 0 ? (
          <MonthCarouselStrip
            key={threePages ? 'carousel-3col' : 'carousel-2col'}
            scrollRef={scrollRef}
            pagerWidth={pagerWidth}
            stableCenterKey={stableCenterKey}
            prevM={prevM}
            nextM={nextM}
            threePages={threePages}
            currentMonth={currentMonth}
            selectedDateStr={selectedDateStr}
            onDateSelect={onDateSelect}
            glass={glass}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollBeginDrag={handleScrollBeginDrag}
            onPrevPress={goPagerPrev}
            onNextPress={goPagerNext}
            lastScrollXRef={lastScrollXRef}
            onMonthKeyRecenter={onMonthKeyRecenter}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    minHeight: CALENDAR_HEADER_ROW_H,
  },
  calendarHeaderMonthText: {
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  carouselPage: {
    flexGrow: 0,
    flexShrink: 0,
  },
  pagerMeasuredHost: {
    alignSelf: 'stretch',
    minHeight: CAROUSEL_PAGE_HEIGHT,
  },
  carouselScroll: {
    overflow: 'hidden',
  },
  carouselContent: {
    flexDirection: 'row',
  },
  pagerPage: {
    alignSelf: 'stretch',
    flexGrow: 0,
    flexShrink: 0,
  },
  calNavBtn: {
    padding: spacing.xs,
  },
  calMonthText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  calMonthTextGlass: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
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
  dayNameTextGlass: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
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
  calStatusPartial: {
    backgroundColor: 'rgba(176, 205, 235, 0.48)',
  },
  calStatusComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.42)',
  },
  calSelectedPartial: {
    backgroundColor: '#E8F4FC',
  },
  calSelectedComplete: {
    backgroundColor: '#ECFDF5',
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
    borderColor: colors.primaryDark,
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
  calDateCellGlass: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_BORDER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 41, 75, 0.12)',
    position: 'relative',
  },
  calGlassStatusPartial: {
    backgroundColor: 'rgba(36, 105, 178, 0.16)',
  },
  calGlassStatusComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  calSelectedGlassPartial: {
    backgroundColor: '#E8F4FC',
  },
  calSelectedGlassComplete: {
    backgroundColor: '#ECFDF5',
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