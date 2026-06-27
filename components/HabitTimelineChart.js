import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';

/** Approximate days visible on screen at once; full history still scrolls horizontally. */
const TARGET_VISIBLE_DAYS = { week: 7, month: 30, quarter: 90 };
const CHART_HEIGHT = 228;
const AXIS_STRIP_WIDTH = 28;
const PLOT_HORIZONTAL_INSET = spacing.regular;
const AXIS_EDGE_PADDING = spacing.sm;
const MARGIN_TOP = 12;
const LABEL_HEIGHT = 28;
const PLOT_BOTTOM = CHART_HEIGHT - LABEL_HEIGHT;
const BINARY_YES_COLOR = colors.success;
const BINARY_NO_COLOR = colors.error;

function formatDayLabel(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  } catch {
    return dateStr?.slice(5) || '';
  }
}

function shouldShowXLabel(index, days, rangeMode) {
  if (rangeMode === 'week') return true;
  if (index === days.length - 1) return true;
  if (rangeMode === 'month') return index % 5 === 0;
  if (rangeMode === 'quarter') return index % 14 === 0;
  return false;
}

function computeNumericDomain(values, { allowNegative = false } = {}) {
  const nums = values.filter((v) => v != null && !isNaN(v));
  if (nums.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    const delta = Math.abs(min) * 0.1 || 1;
    min -= delta;
    max += delta;
  }
  const pad = (max - min) * 0.12 || 1;
  const minPadded = min - pad;
  const maxPadded = max + pad;
  return {
    min: allowNegative ? minPadded : Math.max(0, minPadded),
    max: maxPadded,
  };
}

function buildLineSegments(days, valueKey, yScale) {
  const segments = [];
  let current = [];
  days.forEach((day, index) => {
    const v = day[valueKey];
    if (v != null && !isNaN(v)) {
      current.push({ index, y: yScale(v) });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

function formatAxisValue(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(value < 10 ? 1 : 0);
}

const HabitTimelineChart = ({
  days = [],
  habit,
  sleepMetric,
  rangeMode = 'week',
  sleepColor = colors.primary,
  habitColor = colors.habitTimeline,
  onDayPress,
  viewportWidth,
}) => {
  const scrollRef = useRef(null);
  const isBinary = habit?.type === 'binary';

  const chartWidth = viewportWidth || Dimensions.get('window').width;
  const plotHeight = PLOT_BOTTOM - MARGIN_TOP;

  const columnWidth = useMemo(() => {
    const targetDays = TARGET_VISIBLE_DAYS[rangeMode] ?? TARGET_VISIBLE_DAYS.month;
    const plotViewport = chartWidth - PLOT_HORIZONTAL_INSET * 2;
    return Math.max(6, plotViewport / targetDays);
  }, [chartWidth, rangeMode]);

  const plotWidth = days.length * columnWidth;
  const scrollContentWidth = plotWidth + PLOT_HORIZONTAL_INSET * 2;
  const enableHorizontalScroll = scrollContentWidth > chartWidth + 1;

  const habitValues = useMemo(
    () => days.map((d) => (d.habitValue != null && !isNaN(d.habitValue) ? d.habitValue : null)),
    [days]
  );
  const sleepValues = useMemo(
    () => days.map((d) => (d.sleepValue != null && !isNaN(d.sleepValue) ? d.sleepValue : null)),
    [days]
  );

  const habitDomain = useMemo(() => {
    if (isBinary) return { min: 0, max: 1 };
    return computeNumericDomain(habitValues.filter((v) => v != null));
  }, [habitValues, isBinary]);

  const sleepDomain = useMemo(
    () => computeNumericDomain(sleepValues.filter((v) => v != null)),
    [sleepValues]
  );

  const habitYScale = (value) => {
    const { min, max } = habitDomain;
    const range = max - min || 1;
    const t = (value - min) / range;
    return MARGIN_TOP + plotHeight - t * plotHeight * 0.92;
  };

  const sleepYScale = (value) => {
    const { min, max } = sleepDomain;
    const range = max - min || 1;
    const t = (value - min) / range;
    return MARGIN_TOP + plotHeight - t * plotHeight * 0.92;
  };

  const sleepSegments = useMemo(() => {
    if (isBinary) return [];
    return buildLineSegments(days, 'sleepValue', sleepYScale);
  }, [days, sleepDomain, isBinary]);

  const habitSegments = useMemo(() => {
    if (isBinary) return [];
    return buildLineSegments(days, 'habitValue', habitYScale);
  }, [days, habitDomain, isBinary]);

  const xCenter = (index) =>
    PLOT_HORIZONTAL_INSET + index * columnWidth + columnWidth / 2;

  const leftYLabels = useMemo(() => {
    if (isBinary) return [];
    return [habitDomain.max, habitDomain.min].map((value) => ({
      value,
      y: habitYScale(value),
      label: formatAxisValue(value),
    }));
  }, [habitDomain, isBinary]);

  const rightYLabels = useMemo(() => {
    const { min, max } = sleepDomain;
    return [max, min].map((value) => ({
      value,
      y: sleepYScale(value),
      label: formatAxisValue(value),
    }));
  }, [sleepDomain]);

  const hasAnyHabitData = habitValues.some((v) => v != null);
  const hasAnySleepData = sleepValues.some((v) => v != null);

  useEffect(() => {
    if (!enableHorizontalScroll) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(0, scrollContentWidth - chartWidth),
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [scrollContentWidth, chartWidth, rangeMode, days.length, enableHorizontalScroll]);

  if (!days.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Log this habit on more days to see your history.</Text>
      </View>
    );
  }

  const habitUnitLabel = habit?.unit ? habit.unit : null;
  const sleepUnitLabel = sleepMetric?.unit ? sleepMetric.unit : null;

  const renderAxisLabel = (item, side) => {
    const top = item.y - 7;
    return (
      <Text
        key={`${side}-${item.label}-${item.value}`}
        style={[
          side === 'left' ? styles.axisLabelLeft : styles.axisLabelRight,
          { top, color: side === 'left' ? habitColor : sleepColor },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    );
  };

  const habitName = habit?.name || 'Habit';

  return (
    <View style={styles.wrap}>
      {isBinary ? (
        <View style={styles.binaryLegendBlock}>
          <Text style={styles.binaryLegendHabitName} numberOfLines={1}>
            {habitName}
          </Text>
          <View style={styles.binaryLegendKeyList}>
            <View style={styles.binaryLegendKeyItem}>
              <View style={[styles.legendBarSwatch, { backgroundColor: BINARY_YES_COLOR }]} />
              <Text style={styles.binaryLegendLabel}>Did habit</Text>
            </View>
            <View style={styles.binaryLegendKeyItem}>
              <View style={[styles.legendBarSwatch, { backgroundColor: BINARY_NO_COLOR }]} />
              <Text style={styles.binaryLegendLabel}>Didn't do habit</Text>
            </View>
          </View>
          <Text style={styles.binarySleepCaption} numberOfLines={2}>
            Bar height is {sleepMetric?.label?.toLowerCase() || 'sleep'}
            {sleepUnitLabel ? ` (${sleepUnitLabel})` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: habitColor }]} />
            <Text style={styles.legendText} numberOfLines={2}>
              {habitName}
              {habitUnitLabel ? ` (${habitUnitLabel})` : ''}
              <Text style={styles.legendSide}> · left</Text>
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchOutline, { borderColor: sleepColor }]} />
            <Text style={styles.legendText} numberOfLines={2}>
              {sleepMetric?.label || 'Sleep'}
              {sleepUnitLabel ? ` (${sleepUnitLabel})` : ''}
              <Text style={styles.legendSide}> · right</Text>
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.chartFrame, { width: chartWidth, height: CHART_HEIGHT }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={enableHorizontalScroll}
          showsHorizontalScrollIndicator={enableHorizontalScroll}
          style={[styles.plotScroll, { width: chartWidth, height: CHART_HEIGHT }]}
          contentContainerStyle={{ width: scrollContentWidth, minHeight: CHART_HEIGHT }}
        >
          <Svg width={scrollContentWidth} height={CHART_HEIGHT}>
            <Line
              x1={PLOT_HORIZONTAL_INSET}
              y1={PLOT_BOTTOM}
              x2={scrollContentWidth - PLOT_HORIZONTAL_INSET}
              y2={PLOT_BOTTOM}
              stroke={colors.border}
              strokeWidth={1}
            />

            {isBinary &&
              days.map((day, index) => {
                const hasHabit = day.habitValue != null && day.habitDisplay != null;
                if (!hasHabit || day.sleepValue == null || isNaN(day.sleepValue)) return null;
                const isYes = day.habitValue >= 0.5;
                const barTop = sleepYScale(day.sleepValue);
                const barHeight = PLOT_BOTTOM - barTop;
                if (barHeight <= 1) return null;
                const barWidth = Math.max(6, columnWidth * 0.72);
                const cx = xCenter(index);
                return (
                  <Rect
                    key={`binary-bar-${day.date}`}
                    x={cx - barWidth / 2}
                    y={barTop}
                    width={barWidth}
                    height={barHeight}
                    rx={3}
                    ry={3}
                    fill={isYes ? BINARY_YES_COLOR : BINARY_NO_COLOR}
                    onPress={() => onDayPress?.(day)}
                  />
                );
              })}

            {!isBinary &&
              habitSegments.map((segment, segIdx) =>
                segment.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = segment[i - 1];
                  return (
                    <Line
                      key={`habit-line-${segIdx}-${i}`}
                      x1={xCenter(prev.index)}
                      y1={prev.y}
                      x2={xCenter(pt.index)}
                      y2={pt.y}
                      stroke={habitColor}
                      strokeWidth={2}
                      opacity={0.9}
                    />
                  );
                })
              )}

            {!isBinary &&
              sleepSegments.map((segment, segIdx) =>
                segment.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = segment[i - 1];
                  return (
                    <Line
                      key={`sleep-${segIdx}-${i}`}
                      x1={xCenter(prev.index)}
                      y1={prev.y}
                      x2={xCenter(pt.index)}
                      y2={pt.y}
                      stroke={sleepColor}
                      strokeWidth={2.5}
                    />
                  );
                })
              )}

            {!isBinary &&
              days.map((day, index) => {
                const hasHabit = day.habitValue != null && day.habitDisplay != null;
                if (!hasHabit) return null;
                const r = rangeMode === 'week' ? 5 : 4;
                return (
                  <Circle
                    key={`habit-${day.date}`}
                    cx={xCenter(index)}
                    cy={habitYScale(day.habitValue)}
                    r={r}
                    fill={habitColor}
                    stroke={colors.cardBackground}
                    strokeWidth={1}
                    onPress={() => onDayPress?.(day)}
                  />
                );
              })}

            {!isBinary &&
              days.map((day, index) => {
                if (day.sleepValue == null || isNaN(day.sleepValue)) return null;
                const r = 4;
                return (
                  <Circle
                    key={`sleep-dot-${day.date}`}
                    cx={xCenter(index)}
                    cy={sleepYScale(day.sleepValue)}
                    r={r}
                    fill={sleepColor}
                    stroke={colors.white}
                    strokeWidth={1}
                    onPress={() => onDayPress?.(day)}
                  />
                );
              })}

            {days.map((day, index) => {
              if (!shouldShowXLabel(index, days, rangeMode)) return null;
              return (
                <SvgText
                  key={`label-${day.date}`}
                  x={xCenter(index)}
                  y={CHART_HEIGHT - 4}
                  fontSize={rangeMode === 'week' ? 9 : 8}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {formatDayLabel(day.date)}
                </SvgText>
              );
            })}
          </Svg>
        </ScrollView>

        <View
          style={[styles.axisOverlay, { width: chartWidth, height: CHART_HEIGHT }]}
          pointerEvents="none"
        >
          {!isBinary && (
            <View
              style={[
                styles.axisLabelsColumn,
                styles.axisLabelsLeft,
                { height: plotHeight, marginTop: MARGIN_TOP },
              ]}
            >
              {leftYLabels.map((item) => renderAxisLabel(item, 'left'))}
            </View>
          )}
          <View
            style={[
              styles.axisLabelsColumn,
              styles.axisLabelsRight,
              { height: plotHeight, marginTop: MARGIN_TOP },
            ]}
          >
            {rightYLabels.map((item) => renderAxisLabel(item, 'right'))}
          </View>
        </View>
      </View>

      {!hasAnyHabitData && (
        <Text style={styles.hintText}>No logged days in this range yet.</Text>
      )}
      {isBinary && hasAnyHabitData && !hasAnySleepData && (
        <Text style={styles.hintText}>
          Bars appear when habit days are paired with sleep data for the selected metric.
        </Text>
      )}
      {!isBinary && hasAnyHabitData && !hasAnySleepData && (
        <Text style={styles.hintText}>Sleep line uses the right-hand scale when nights are paired.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.small,
  },
  binaryLegendBlock: {
    marginBottom: spacing.small,
    paddingHorizontal: spacing.sm,
  },
  binaryLegendHabitName: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  binaryLegendKeyList: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  binaryLegendKeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  binaryLegendLabel: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flexShrink: 0,
  },
  legendBarSwatch: {
    width: 14,
    height: 10,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  binarySleepCaption: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.regular,
    marginBottom: spacing.small,
    paddingHorizontal: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.tiny,
  },
  legendSwatchOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  legendText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: typography.weights.medium,
  },
  legendSide: {
    color: colors.textLight,
    fontWeight: typography.weights.regular,
  },
  chartFrame: {
    position: 'relative',
    alignSelf: 'center',
  },
  plotScroll: {
    flexGrow: 0,
  },
  axisOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  axisLabelsColumn: {
    width: AXIS_STRIP_WIDTH,
    position: 'absolute',
  },
  axisLabelsLeft: {
    left: PLOT_HORIZONTAL_INSET,
  },
  axisLabelsRight: {
    right: PLOT_HORIZONTAL_INSET,
  },
  axisLabelLeft: {
    position: 'absolute',
    left: 0,
    fontSize: 8,
    fontWeight: typography.weights.semibold,
    width: AXIS_STRIP_WIDTH,
    textAlign: 'left',
    paddingLeft: 2,
  },
  axisLabelRight: {
    position: 'absolute',
    right: 0,
    fontSize: 8,
    fontWeight: typography.weights.semibold,
    width: AXIS_STRIP_WIDTH,
    textAlign: 'right',
    paddingRight: 2,
  },
  emptyWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hintText: {
    fontSize: typography.sizes.small,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.small,
    paddingHorizontal: spacing.regular,
  },
});

export default HabitTimelineChart;
