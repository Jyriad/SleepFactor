import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, TouchableOpacity } from 'react-native';
import Svg, { Line, Text as SvgText, G, Rect } from 'react-native-svg';
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
  xValueFormatter = null, // Optional function to format x-axis values
  /** When true and there are no points, still draw axes + labels (e.g. onboarding). */
  showEmptyAxes = false,
  emptyAxesXRange = { min: 0, max: 10 },
  emptyAxesYRange = { min: 30, max: 90 },
  /**
   * When set, axis min/max stay fixed (e.g. onboarding demo) instead of fitting the current points.
   * Use with emptyAxes ranges or the same values so the frame does not jump as points appear.
   */
  fixedDomainX = null,
  fixedDomainY = null,
}) => {
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Filter out invalid data points
  const validData = (data || []).filter(point => {
    if (!point) return false;
    const xValid = point.x !== null && point.x !== undefined && !isNaN(point.x) && isFinite(point.x);
    const yValid = point.y !== null && point.y !== undefined && !isNaN(point.y) && isFinite(point.y);
    return xValid && yValid;
  });

  const useFixedDomain =
    fixedDomainX != null &&
    fixedDomainY != null &&
    Number.isFinite(fixedDomainX.min) &&
    Number.isFinite(fixedDomainX.max) &&
    Number.isFinite(fixedDomainY.min) &&
    Number.isFinite(fixedDomainY.max) &&
    fixedDomainX.max > fixedDomainX.min &&
    fixedDomainY.max > fixedDomainY.min;

  const useEmptyAxes =
    validData.length === 0 &&
    showEmptyAxes &&
    xLabel &&
    yLabel;

  const showChartWithNoPoints =
    validData.length === 0 && xLabel && yLabel && (useEmptyAxes || useFixedDomain);

  if (validData.length === 0 && !showChartWithNoPoints) {
    return (
      <View style={[styles.container, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.noDataText, { textAlign: 'center' }]}>No data available</Text>
      </View>
    );
  }

  // Extract x and y values for scaling
  const xValues = validData.length ? validData.map(point => point.x) : [];
  const yValues = validData.length ? validData.map(point => point.y) : [];

  // Axis ranges: optional fixed domain (onboarding), else empty preview, else fit data
  let xMin;
  let xMax;
  let yMin;
  let yMax;
  if (useFixedDomain) {
    xMin = fixedDomainX.min;
    xMax = fixedDomainX.max;
    yMin = fixedDomainY.min;
    yMax = fixedDomainY.max;
  } else if (validData.length === 0) {
    xMin = emptyAxesXRange.min;
    xMax = emptyAxesXRange.max;
    yMin = emptyAxesYRange.min;
    yMax = emptyAxesYRange.max;
  } else {
    xMin = Math.min(...xValues);
    xMax = Math.max(...xValues);
    yMin = Math.min(...yValues);
    yMax = Math.max(...yValues);
  }

  const xRange = xMax - xMin || 1;
  // Ensure yRange is never 0 - if all y values are the same, add padding (skip when fixed domain)
  let displayYMin = yMin;
  let displayYMax = yMax;
  let yRange = yMax - yMin;
  if (!useFixedDomain && yRange === 0) {
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

  // Trend line uses only points included in analysis (excluded nights stay on chart but don't steer the line)
  const includedForRegression = validData.filter(p => !p.exclude_from_insights);
  const regressionX = includedForRegression.length >= 2
    ? includedForRegression.map(p => p.x)
    : xValues;
  const regressionY = includedForRegression.length >= 2
    ? includedForRegression.map(p => p.y)
    : yValues;

  // Calculate trend line if requested
  let trendLineData = null;
  if (showTrendLine && regressionX.length >= 2) {
    const regression = calculateLinearRegression(regressionX, regressionY);
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

  // Chart dimensions with proper margins for axes (extra left gutter when Y label is shown)
  const safeWidth = Math.max(width, 100);
  const safeHeight = Math.max(height, 100);
  // Bottom margin: only enough for x-axis tick labels (title sits in RN Text below SVG).
  const margin = {
    top: 40,
    right: 20,
    bottom: 30,
    left: yLabel ? 76 : 60,
  };
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

  return (
    <View style={[styles.container, { width: safeWidth }]}>
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

            {/* X-axis title is rendered below the SVG so it can wrap and is not clipped. */}

            {yLabel && (
              <SvgText
                x={margin.left / 2}
                y={margin.top + chartHeight / 2}
                textAnchor="middle"
                fontSize={12}
                fontWeight="bold"
                fill={colors.textPrimary}
                transform={`rotate(-90, ${margin.left / 2}, ${margin.top + chartHeight / 2})`}
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

            {/* Data points — crosses read better than circles when points overlap */}
            {validData.map((point, index) => {
              const isExcluded = point.exclude_from_insights || false;
              const isAutoExcluded = point.auto_excluded || false;

              let crossColor = pointColor;
              let crossOpacity = 0.8;
              let arm = 8;
              let lineStrokeWidth = 2.5;
              let ringColor = null;

              if (isExcluded) {
                arm = 5;
                crossOpacity = 0.4;
                lineStrokeWidth = 2;
                ringColor = isAutoExcluded ? colors.warning : colors.error;
                crossColor = colors.textSecondary;
              }

              const cx = xScale(point.x);
              const cy = yScale(point.y);
              const ringArm = ringColor != null ? arm + 2 : null;

              return (
                <G key={`point-${index}`}>
                  {ringColor != null && ringArm != null && (
                    <G opacity={0.95}>
                      <Line
                        x1={cx - ringArm}
                        y1={cy}
                        x2={cx + ringArm}
                        y2={cy}
                        stroke={ringColor}
                        strokeWidth={lineStrokeWidth + 1}
                        strokeLinecap="round"
                      />
                      <Line
                        x1={cx}
                        y1={cy - ringArm}
                        x2={cx}
                        y2={cy + ringArm}
                        stroke={ringColor}
                        strokeWidth={lineStrokeWidth + 1}
                        strokeLinecap="round"
                      />
                    </G>
                  )}
                  <G opacity={crossOpacity}>
                    <Line
                      x1={cx - arm}
                      y1={cy}
                      x2={cx + arm}
                      y2={cy}
                      stroke={crossColor}
                      strokeWidth={lineStrokeWidth}
                      strokeLinecap="round"
                    />
                    <Line
                      x1={cx}
                      y1={cy - arm}
                      x2={cx}
                      y2={cy + arm}
                      stroke={crossColor}
                      strokeWidth={lineStrokeWidth}
                      strokeLinecap="round"
                    />
                  </G>
                </G>
              );
            })}
          </Svg>
        </TouchableOpacity>
        {xLabel ? (
          <Text style={[styles.xAxisCaption, { width: safeWidth }]}>{xLabel}</Text>
        ) : null}
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
    overflow: 'visible',
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  xAxisCaption: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: 2,
    paddingBottom: 0,
    lineHeight: 18,
  },
});

export default ScatterPlot;