import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Path, Text as SvgText, Circle } from 'react-native-svg';
import { colors, typography } from '../constants';
import { formatDrugLevel } from '../utils/drugHalfLife';

/**
 * Line chart for drug level over time. Optional crosshair: vertical at markerTime,
 * horizontal to y-axis at markerLevel (matches "now" or "bedtime" readout).
 */
const DrugLevelLineChart = ({
  dataPoints,
  unit = 'units',
  width = 300,
  height = 160,
  color = colors.primary,
  formatTimeLabel = null,
  /** When set, draws crosshair (today = now, past day = bedtime) */
  crosshairTime = null,
  crosshairLevel = null,
  crosshairLabel = '',
}) => {
  if (!dataPoints || dataPoints.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No level data for today</Text>
      </View>
    );
  }

  const margin = { top: 16, right: 24, bottom: 32, left: 48 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const dayStart = useMemo(() => new Date(dataPoints[0].time).getTime(), [dataPoints]);
  const dayEnd = useMemo(
    () => new Date(dataPoints[dataPoints.length - 1].time).getTime(),
    [dataPoints]
  );
  const dayMs = Math.max(1, dayEnd - dayStart);

  const levels = dataPoints.map((p) => p.level);
  const yMin = 0;
  const yMax = Math.max(1, Math.max(...levels, crosshairLevel ?? 0) * 1.1);
  const yRange = yMax - yMin;

  const xForTime = (t) => {
    const ms = t instanceof Date ? t.getTime() : new Date(t).getTime();
    const f = (ms - dayStart) / dayMs;
    const clamped = Math.max(0, Math.min(1, f));
    return margin.left + clamped * chartWidth;
  };

  const yScale = (value) =>
    margin.top + chartHeight - ((value - yMin) / yRange) * chartHeight;

  const pathD = dataPoints
    .map((p, i) => {
      const x = xForTime(p.time);
      const y = yScale(p.level);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const numYLabels = 4;
  const yLabels = [];
  for (let i = 0; i <= numYLabels; i++) {
    const value = yMin + (i / numYLabels) * yRange;
    yLabels.push({ value, y: yScale(value) });
  }

  const HOURS = [0, 8, 16, 24];
  const formatHour = (hour) => {
    const d = new Date(2000, 0, 1, hour, 0, 0);
    if (formatTimeLabel) return formatTimeLabel(d);
    return hour === 0 || hour === 24
      ? '12:00 AM'
      : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  const xLabels = HOURS.map((hour, i) => ({
    label: formatHour(hour),
    x: margin.left + (i / (HOURS.length - 1)) * chartWidth,
  }));

  const showCrosshair =
    crosshairTime != null &&
    crosshairLevel != null &&
    !Number.isNaN(Number(crosshairLevel));
  const cx = showCrosshair ? xForTime(crosshairTime) : null;
  const cy = showCrosshair ? yScale(Math.min(Number(crosshairLevel), yMax)) : null;
  const axisY = margin.top + chartHeight;

  const crosshairTimeStr = showCrosshair
    ? formatTimeLabel
      ? formatTimeLabel(crosshairTime instanceof Date ? crosshairTime : new Date(crosshairTime))
      : (crosshairTime instanceof Date ? crosshairTime : new Date(crosshairTime)).toLocaleTimeString(
          'en-US',
          { hour: 'numeric', minute: '2-digit', hour12: true }
        )
    : '';
  const crosshairLevelStr = showCrosshair
    ? formatDrugLevel(Number(crosshairLevel), unit, 1)
    : '';
  const axisLabelFontSize = 9;
  const axisLabelFill = colors.textSecondary;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={axisY}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Line
          x1={margin.left}
          y1={axisY}
          x2={margin.left + chartWidth}
          y2={axisY}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
        {showCrosshair && (
          <>
            <Line
              x1={cx}
              y1={axisY}
              x2={cx}
              y2={cy}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <Line
              x1={margin.left}
              y1={cy}
              x2={cx}
              y2={cy}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <Circle cx={cx} cy={cy} r={4} fill={color} stroke={colors.cardBackground} strokeWidth={2} />
            {/* Level at y-axis (left intercept) */}
            <SvgText
              x={margin.left - 6}
              y={cy + 3}
              textAnchor="end"
              fontSize={axisLabelFontSize}
              fill={axisLabelFill}
            >
              {crosshairLevelStr}
            </SvgText>
            {/* Time at x-axis (bottom intercept) */}
            <SvgText
              x={cx}
              y={axisY + 14}
              textAnchor="middle"
              fontSize={axisLabelFontSize}
              fill={axisLabelFill}
            >
              {crosshairTimeStr}
            </SvgText>
            {crosshairLabel ? (
              <SvgText
                x={Math.min(cx + 6, margin.left + chartWidth - 36)}
                y={Math.max(cy - 8, margin.top + 10)}
                fontSize={axisLabelFontSize}
                fill={axisLabelFill}
              >
                {crosshairLabel}
              </SvgText>
            ) : null}
          </>
        )}
        {yLabels.map((item, i) => (
          <SvgText
            key={`y-${i}`}
            x={margin.left - 8}
            y={item.y + 4}
            textAnchor="end"
            fontSize={10}
            fill={colors.textSecondary}
          >
            {formatDrugLevel(item.value, unit, 0)}
          </SvgText>
        ))}
        {xLabels.map((item, i) => (
          <SvgText
            key={`x-${i}`}
            x={item.x}
            y={height - 10}
            textAnchor="middle"
            fontSize={10}
            fill={colors.textSecondary}
          >
            {item.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default DrugLevelLineChart;
