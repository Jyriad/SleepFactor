import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Rect } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Scatter chart component for visualizing relationships between two variables
 */
const ScatterPlot = ({
  data,
  width = 300,
  height = 200,
  xLabel,
  yLabel,
  title,
  showTrendLine = true,
  color = colors.primary,
  pointColor = colors.primary,
  trendLineColor = colors.error,
  correlation = null,
  correlationStrength = 'weak',
  trendDirection = 'none',
  onPointPress = null, // Callback for data point presses
  xValueFormatter = null // Optional function to format x-axis values
}) => {
  const [selectedPoint, setSelectedPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Filter out invalid data points
  const validData = data.filter(point => {
    if (!point) return false;
    const xValid = point.x !== null && point.x !== undefined && !isNaN(point.x) && isFinite(point.x);
    const yValid = point.y !== null && point.y !== undefined && !isNaN(point.y) && isFinite(point.y);
    return xValid && yValid;
  });

  if (validData.length === 0) {
    return (
      <View style={[styles.container, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No valid data for visualization</Text>
      </View>
    );
  }

  // Extract x and y values for scaling
  const xValues = validData.map(point => point.x);
  const yValues = validData.map(point => point.y);

  // Calculate original ranges
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  const xRange = xMax - xMin || 1;
  // Ensure yRange is never 0 - if all y values are the same, add padding
  let displayYMin = yMin;
  let displayYMax = yMax;
  let yRange = yMax - yMin;
  if (yRange === 0) {
    // If all y values are the same, add 10% padding above and below
    const padding = Math.abs(yMin) * 0.1 || 1;
    displayYMin = yMin - padding;
    displayYMax = yMax + padding;
    yRange = padding * 2;
  }

  // Use original ranges for axis markers - don't recalculate during zoom
  const displayXMin = xMin;
  const displayXMax = xMax;
  const displayXRange = xRange;
  const displayYRange = yRange;

  // Calculate trend line if requested (using original data)
  let trendLineData = null;
  if (showTrendLine && validData.length >= 2) {
    const regression = calculateLinearRegression(xValues, yValues);
    if (regression && !isNaN(regression.slope) && !isNaN(regression.intercept)) {
      // Create trend line points across the display x-range
      const trendXMin = displayXMin;
      const trendXMax = displayXMax;
      const trendYMin = regression.slope * trendXMin + regression.intercept;
      const trendYMax = regression.slope * trendXMax + regression.intercept;

      trendLineData = [
        { x: trendXMin, y: trendYMin },
        { x: trendXMax, y: trendYMax }
      ];
    }
  }

  // Transform data for gifted-charts format
  const scatterData = validData.map((point, index) => ({
    x: point.x,
    y: point.y,
    index: index,
    date: point.date || 'Unknown date',
    dataPointText: point.date || 'Unknown date'
  }));

  // Chart dimensions with proper margins for axes
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };
  const chartWidth = safeWidth - margin.left - margin.right;
  const chartHeight = safeHeight - margin.top - margin.bottom;

  // Helper function to calculate nice tick marks
  const calculateNiceTicks = (min, max, numTicks = 5) => {
    const range = max - min;
    if (range === 0) return { start: min, end: max, step: 1 };

    const roughStep = range / numTicks;

    // Find magnitude and normalize
    const magnitude = Math.floor(Math.log10(Math.abs(roughStep)));
    const magnitudePow = Math.pow(10, magnitude);
    const normalizedStep = roughStep / magnitudePow;

    // Find nice step size (1, 2, 5, 10)
    let niceStep;
    if (normalizedStep <= 1) niceStep = 1;
    else if (normalizedStep <= 2) niceStep = 2;
    else if (normalizedStep <= 5) niceStep = 5;
    else niceStep = 10;

    niceStep *= magnitudePow;

    // Calculate nice start and end points
    const niceStart = Math.floor(min / niceStep) * niceStep;
    const niceEnd = Math.ceil(max / niceStep) * niceStep;

    return { start: niceStart, end: niceEnd, step: niceStep };
  };

  // Find the closest data point to touch coordinates
  const findClosestPoint = (touchX, touchY) => {
    if (!validData || validData.length === 0) return null;

    let closestPoint = null;
    let closestDistance = Infinity;

    validData.forEach((point, index) => {
      const pointScreenX = xScale(point.x);
      const pointScreenY = yScale(point.y);

      // Calculate Euclidean distance
      const distance = Math.sqrt(
        Math.pow(touchX - pointScreenX, 2) + Math.pow(touchY - pointScreenY, 2)
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = { ...point, screenX: pointScreenX, screenY: pointScreenY, distance };
      }
    });

    // Only return the point if it's within a reasonable touch distance (e.g., 50px radius for easier tapping)
    return closestDistance <= 50 ? closestPoint : null;
  };

  // Handle container press with coordinate-based hit testing
  const handleContainerPress = (event) => {
    const { locationX, locationY } = event.nativeEvent;

    const chartX = locationX;
    const chartY = locationY;

    const closestPoint = findClosestPoint(chartX, chartY);

    if (closestPoint) {
      setSelectedPoint(closestPoint);

      if (onPointPress) {
        onPointPress(closestPoint);
      } else {
        Alert.alert(
          'Data Point Details',
          `Date: ${closestPoint.date}\n${xLabel}: ${closestPoint.x}\n${yLabel}: ${closestPoint.y}`,
          [
            { text: 'View Details', onPress: () => {
              Alert.alert('Navigation Placeholder', 'This would navigate to a detailed view of this data point');
            }},
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    }
  };

  // Create scales for positioning
  const xScale = (value) => ((value - displayXMin) / displayXRange) * chartWidth + margin.left;
  const yScale = (value) => chartHeight - ((value - displayYMin) / displayYRange) * chartHeight + margin.top;


  // Generate axis markers with nice number rounding
  const generateAxisMarkers = () => {
    const xMarkers = [];
    const yMarkers = [];

    // X-axis markers (bottom) - use nice rounding
    const xNice = calculateNiceTicks(displayXMin, displayXMax, 5);
    for (let i = 0; i <= 5; i++) {
      const value = xNice.start + (xNice.step * i);
      // Only include markers within the actual data range
      if (value >= displayXMin && value <= displayXMax) {
        const ratio = (value - displayXMin) / displayXRange;
        const x = margin.left + (ratio * chartWidth);
        // Use formatter if provided, otherwise default formatting
        const formattedValue = xValueFormatter
          ? xValueFormatter(value)
          : value.toFixed(value % 1 === 0 ? 0 : 1); // No decimals for whole numbers
        xMarkers.push({
          value: formattedValue,
          x: x,
          y: safeHeight - margin.bottom + 15
        });
      }
    }

    // Y-axis markers (left) - use nice rounding
    const yNice = calculateNiceTicks(displayYMin, displayYMax, 5);
    for (let i = 0; i <= 5; i++) {
      const value = yNice.start + (yNice.step * i);
      // Only include markers within the actual data range
      if (value >= displayYMin && value <= displayYMax) {
        const ratio = (value - displayYMin) / displayYRange;
        const y = margin.top + chartHeight - (ratio * chartHeight);
        yMarkers.push({
          value: value.toFixed(value % 1 === 0 ? 0 : 1), // No decimals for whole numbers
          x: margin.left - 10,
          y: y + 4
        });
      }
    }

    return { xMarkers, yMarkers };
  };

  const { xMarkers, yMarkers } = generateAxisMarkers();

  // Include space for stats text below the chart (prevents overlap with content below)
  const statsAreaHeight = 28;
  const totalHeight = safeHeight + statsAreaHeight;

  return (
    <View style={[styles.container, { width: safeWidth, minHeight: totalHeight }]}>
      <TouchableOpacity
        style={styles.chartContainer}
        onPress={handleContainerPress}
        activeOpacity={1}
      >
        <Svg width={safeWidth} height={safeHeight}>
          <Rect
            x={0}
            y={0}
            width={safeWidth}
            height={safeHeight}
            fill={colors.cardBackground}
          />


            {/* Grid lines */}
            {xMarkers.map((marker, index) => (
              <Line
                key={`x-grid-${index}`}
                x1={marker.x}
                y1={margin.top}
                x2={marker.x}
                y2={margin.top + chartHeight}
                stroke={colors.border}
                strokeWidth={1}
                opacity={0.3}
              />
            ))}

            {yMarkers.map((marker, index) => (
              <Line
                key={`y-grid-${index}`}
                x1={margin.left}
                y1={marker.y - 4}
                x2={margin.left + chartWidth}
                y2={marker.y - 4}
                stroke={colors.border}
                strokeWidth={1}
                opacity={0.3}
              />
            ))}

            {/* Axis lines */}
            <Line
              x1={margin.left}
              y1={margin.top + chartHeight}
              x2={margin.left + chartWidth}
              y2={margin.top + chartHeight}
              stroke={colors.textSecondary}
              strokeWidth={1}
            />
            <Line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + chartHeight}
              stroke={colors.textSecondary}
              strokeWidth={1}
            />

            {/* Trend line */}
            {trendLineData && trendLineData.length >= 2 && (
              <Line
                x1={xScale(trendLineData[0].x)}
                y1={yScale(trendLineData[0].y)}
                x2={xScale(trendLineData[1].x)}
                y2={yScale(trendLineData[1].y)}
                stroke={trendLineColor}
                strokeWidth={2}
              />
            )}

            {/* Axis labels */}
            {xLabel && (
              <SvgText
                x={margin.left + chartWidth / 2}
                y={safeHeight - 10}
                textAnchor="middle"
                fontSize={12}
                fontWeight="bold"
                fill={colors.textPrimary}
                fontFamily="monospace"
              >
                {xLabel}
              </SvgText>
            )}

            {yLabel && (
              <SvgText
                x={12}
                y={margin.top + chartHeight / 2}
                textAnchor="middle"
                fontSize={12}
                fontWeight="bold"
                fill={colors.textPrimary}
                fontFamily="monospace"
                transform={`rotate(-90, 12, ${margin.top + chartHeight / 2})`}
              >
                {yLabel}
              </SvgText>
            )}

            {/* X-axis markers and labels */}
            {xMarkers.map((marker, index) => (
              <SvgText
                key={`x-marker-${index}`}
                x={marker.x}
                y={marker.y}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textSecondary}
                fontFamily="monospace"
              >
                {marker.value}
              </SvgText>
            ))}

            {/* Y-axis markers and labels */}
            {yMarkers.map((marker, index) => (
              <SvgText
                key={`y-marker-${index}`}
                x={marker.x}
                y={marker.y}
                textAnchor="end"
                fontSize={10}
                fill={colors.textSecondary}
                fontFamily="monospace"
              >
                {marker.value}
              </SvgText>
            ))}

            {/* Data points */}
            {validData.map((point, index) => {
              const isOutlier = point.isOutlier || false;
              const isExcluded = point.exclude_from_insights || false;
              const isAutoExcluded = point.auto_excluded || false;

              // Determine visual properties based on exclusion status
              let pointFillColor = pointColor;
              let pointOpacity = 0.8;
              let pointRadius = 10;
              let strokeColor = 'none';
              let strokeWidth = 0;

              if (isExcluded) {
                // Excluded points are smaller, more transparent, and have a border
                pointRadius = 6;
                pointOpacity = 0.4;
                strokeColor = isAutoExcluded ? colors.warning : colors.error;
                strokeWidth = 2;
                pointFillColor = colors.textSecondary;
              } else if (isOutlier) {
                // Outliers (but not excluded) are slightly dimmed
                pointFillColor = colors.textSecondary;
                pointOpacity = 0.6;
              }

              return (
                <Circle
                  key={`point-${index}`}
                  cx={xScale(point.x)}
                  cy={yScale(point.y)}
                  r={pointRadius}
                  fill={pointFillColor}
                  opacity={pointOpacity}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
              );
            })}
          </Svg>
        </TouchableOpacity>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Prevent chart from spilling outside container
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default ScatterPlot;