import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';
import { formatDrugLevel } from '../utils/drugHalfLife';

/**
 * Line chart for drug level over time (e.g. level over today).
 * Uses same tech as ScatterChart (react-native-svg). dataPoints: [{ time: Date, level: number }].
 */
/**
 * @param { (date: Date) => string } [formatTimeLabel] - Optional. Formats time for x-axis; uses profile 12/24h preference when provided.
 */
const DrugLevelLineChart = ({
  dataPoints,
  unit = 'units',
  width = 300,
  height = 160,
  color = colors.primary,
  formatTimeLabel = null,
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

  const levels = dataPoints.map(p => p.level);
  const yMin = 0;
  const yMax = Math.max(1, Math.max(...levels) * 1.1);
  const yRange = yMax - yMin;

  const xScale = (index) => margin.left + (index / Math.max(1, dataPoints.length - 1)) * chartWidth;
  const yScale = (value) => margin.top + chartHeight - ((value - yMin) / yRange) * chartHeight;

  const pathD = dataPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.level)}`)
    .join(' ');

  const numYLabels = 4;
  const yLabels = [];
  for (let i = 0; i <= numYLabels; i++) {
    const value = yMin + (i / numYLabels) * yRange;
    const y = yScale(value);
    yLabels.push({ value, y });
  }

  // X-axis: one label every 8 hours (4 labels) to avoid crowding
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

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + chartHeight} stroke={colors.border} strokeWidth={1} />
        <Line x1={margin.left} y1={margin.top + chartHeight} x2={margin.left + chartWidth} y2={margin.top + chartHeight} stroke={colors.border} strokeWidth={1} />
        <Path d={pathD} stroke={color} strokeWidth={2} fill="none" />
        {yLabels.map((item, i) => (
          <SvgText key={`y-${i}`} x={margin.left - 8} y={item.y + 4} textAnchor="end" fontSize={10} fill={colors.textSecondary}>
            {formatDrugLevel(item.value, unit, 0)}
          </SvgText>
        ))}
        {xLabels.map((item, i) => (
          <SvgText key={`x-${i}`} x={item.x} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.textSecondary}>
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
