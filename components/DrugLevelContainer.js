import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import { formatDrugLevel } from '../utils/drugHalfLife';
import drugLevelService from '../services/drugLevelService';
import DrugLevelLineChart from './DrugLevelLineChart';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const { width: screenWidth } = require('react-native').Dimensions.get('window');
const CHART_AREA_PADDING = 15; // Padding around chart so axis labels aren’t cut off
const CHART_WIDTH = screenWidth - CHART_AREA_PADDING * 2 - 32;
const CHART_HEIGHT = 160;

/**
 * Collapsible container showing "level right now" (today) or "level at bedtime" (past dates), and line chart when expanded.
 * Used on Home (Caffeine / Alcohol) and in Log tab inside the habit block.
 * When selectedDate is passed and is not today, shows level at bedtime (same figure used for insight analysis).
 */
const DrugLevelContainer = ({ habit, userId, selectedDate = null, compact = false, levelRefreshKey = 0 }) => {
  const { formatTime } = useUserPreferences();
  const [expanded, setExpanded] = useState(false);
  const [levelNow, setLevelNow] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [timelineForDate, setTimelineForDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const timelineRequestIdRef = useRef(0);

  const dateStr = selectedDate instanceof Date
    ? selectedDate.toISOString().split('T')[0]
    : (typeof selectedDate === 'string' ? selectedDate.split('T')[0] : null);
  const todayStr = new Date().toISOString().split('T')[0];
  const isViewingToday = !dateStr || dateStr === todayStr;

  useEffect(() => {
    if (!habit?.id || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isViewingToday) {
          const result = await drugLevelService.getLevelNow(userId, habit);
          if (!cancelled) setLevelNow(result);
        } else {
          const result = await drugLevelService.getLevelAtBedtime(userId, habit, dateStr);
          if (!cancelled) setLevelNow(result);
        }
      } catch (e) {
        if (!cancelled) setLevelNow({ level: 0, unit: habit.unit || 'units' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, habit?.id, habit?.unit, isViewingToday, dateStr, levelRefreshKey]);

  useEffect(() => {
    if (!expanded || !habit?.id || !userId) {
      setTimeline(null);
      setTimelineForDate(null);
      return;
    }
    const targetDateStr = dateStr || todayStr;
    timelineRequestIdRef.current += 1;
    const thisRequestId = timelineRequestIdRef.current;
    console.log('[DrugLevel] timeline effect run', { dateStr, todayStr, targetDateStr, isViewingToday, thisRequestId });
    setTimeline(null);
    setTimelineForDate(null);
    setTimelineLoading(true);
    let cancelled = false;
    const fetchTimeline = isViewingToday
      ? drugLevelService.getLevelTimelineForToday(userId, habit)
      : drugLevelService.getLevelTimelineForDate(userId, habit, dateStr);
    fetchTimeline.then((result) => {
      const firstTime = result?.dataPoints?.[0]?.time;
      const lastTime = result?.dataPoints?.[result.dataPoints.length - 1]?.time;
      console.log('[DrugLevel] timeline fetch resolved', { thisRequestId, cancelled, targetDateStr, points: result?.dataPoints?.length, firstTime: firstTime?.toISOString?.(), lastTime: lastTime?.toISOString?.() });
      if (!cancelled && thisRequestId === timelineRequestIdRef.current) {
        setTimeline(result);
        setTimelineForDate(targetDateStr);
        setTimelineLoading(false);
      } else {
        console.log('[DrugLevel] timeline result discarded (stale or cancelled)', { thisRequestId, currentId: timelineRequestIdRef.current });
      }
    }).catch((err) => {
      console.log('[DrugLevel] timeline fetch error', { thisRequestId, err: err?.message });
      if (!cancelled && thisRequestId === timelineRequestIdRef.current) {
        setTimeline({ dataPoints: [], unit: habit?.unit });
        setTimelineForDate(targetDateStr);
        setTimelineLoading(false);
      }
    });
    return () => {
      cancelled = true;
      console.log('[DrugLevel] timeline effect cleanup', { thisRequestId });
    };
  }, [expanded, userId, habit?.id, habit?.unit, isViewingToday, dateStr, todayStr, selectedDate, levelRefreshKey]);

  const displayLevel = levelNow != null
    ? formatDrugLevel(levelNow.level, levelNow.unit, 1)
    : '—';

  const name = habit?.name || 'Level';

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name={name.toLowerCase().includes('caffeine') ? 'cafe-outline' : 'wine-outline'}
            size={compact ? 18 : 20}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
            {name}: {loading ? '...' : displayLevel} {isViewingToday ? 'right now' : 'at bedtime'}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.expandedContent}>
          {timelineLoading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.chartPlaceholderText}>
                {isViewingToday ? 'Loading level over today...' : 'Loading level for this day...'}
              </Text>
            </View>
          ) : timeline?.dataPoints?.length > 0 && timelineForDate === (dateStr || todayStr) ? (
            <DrugLevelLineChart
              key={dateStr || todayStr}
              dataPoints={timeline.dataPoints}
              unit={timeline.unit || habit?.unit}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              formatTimeLabel={formatTime}
            />
          ) : (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                {isViewingToday ? 'No level data for today' : 'No level data for this day'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: CHART_AREA_PADDING,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    marginVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  titleCompact: {
    fontSize: typography.sizes.small,
  },
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default DrugLevelContainer;
