import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText, Path } from 'react-native-svg';
import { colors, typography, spacing } from '../constants';
import { calculateLinearRegression } from '../utils/statistics';

/**
 * Generate nice, rounded axis labels
 * Returns an array of nicely rounded values between min and max
 */
const getNiceLabels = (min, max, numLabels = 5) => {
  const range = max - min;
  if (range === 0) return [min];
  
  const rawStep = range / (numLabels - 1);
  
  // Calculate a "nice" step size (round to nearest power of 10, 2, 5, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / magnitude;
  
  let niceStep;
  if (normalizedStep <= 1) niceStep = 1 * magnitude;
  else if (normalizedStep <= 2) niceStep = 2 * magnitude;
  else if (normalizedStep <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  
  // Round min down and max up to nice values
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  
  const labels = [];
  for (let value = niceMin; value <= niceMax + niceStep * 0.001; value += niceStep) {
    // Only include values that are within or close to our range
    if (value >= niceMin - niceStep * 0.001 && value <= niceMax + niceStep * 0.001) {
      labels.push(value);
    }
  }
  
  return labels;
};

/**
 * Scatter chart component for visualizing relationships between two variables
 * Custom SVG implementation for full control and reliability
 * Shows individual data points and optional trend line
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
  trendLineColor = colors.error, // Use error color (red) for better visibility
  correlation = null,
  correlationStrength = 'weak',
  trendDirection = 'none'
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Filter out invalid data points (NaN, null, undefined)
  const validData = data.filter(point => 
    point && 
    point.x !== null && point.x !== undefined && !isNaN(point.x) && isFinite(point.x) &&
    point.y !== null && point.y !== undefined && !isNaN(point.y) && isFinite(point.y)
  );

  if (validData.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No valid data points</Text>
      </View>
    );
  }

  // Extract x and y values from valid data
  const xValues = validData.map(point => point.x);
  const yValues = validData.map(point => point.y);

  // Calculate ranges for scaling
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);

  // Validate ranges
  if (isNaN(xMin) || isNaN(xMax) || isNaN(yMin) || isNaN(yMax)) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>Invalid data range</Text>
      </View>
    );
  }

  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Add padding to ranges (10% on each side)
  const xPadding = xRange * 0.1 || 1;
  const yPadding = yRange * 0.1 || 1;

  const plotXMin = xMin - xPadding;
  const plotXMax = xMax + xPadding;
  const plotYMin = Math.max(0, yMin - yPadding); // Don't go below 0 for sleep metrics
  const plotYMax = yMax + yPadding;

  // Chart dimensions - increased bottom padding for axis title, left for Y-axis title
  const padding = { top: 20, right: 40, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Convert data point to pixel coordinates
  const toPixelX = (x) => {
    return padding.left + ((x - plotXMin) / (plotXMax - plotXMin)) * chartWidth;
  };

  const toPixelY = (y) => {
    return padding.top + chartHeight - ((y - plotYMin) / (plotYMax - plotYMin)) * chartHeight;
  };

  // Prepare scatter plot data
  const scatterPoints = validData.map(point => ({
    x: point.x,
    y: point.y,
    pixelX: toPixelX(point.x),
    pixelY: toPixelY(point.y),
  }));

  // Calculate trend line if requested
  let trendLinePoints = null;
  let trendLinePath = null;
  if (showTrendLine && validData.length >= 3) {
    const regression = calculateLinearRegression(xValues, yValues);
    const { slope, intercept } = regression;

    // Validate regression values
    if (slope !== null && slope !== undefined && !isNaN(slope) && isFinite(slope) &&
        intercept !== null && intercept !== undefined && !isNaN(intercept) && isFinite(intercept)) {
      // Generate trend line points
      const numPoints = 100;
      trendLinePoints = [];
      for (let i = 0; i <= numPoints; i++) {
        const x = plotXMin + (i / numPoints) * (plotXMax - plotXMin);
        const y = slope * x + intercept;
        const clampedY = Math.max(plotYMin, Math.min(plotYMax, y));
        if (!isNaN(x) && !isNaN(clampedY) && isFinite(x) && isFinite(clampedY)) {
          trendLinePoints.push({
            x: toPixelX(x),
            y: toPixelY(clampedY),
          });
        }
      }
      
      // Build path string for dashed line
      if (trendLinePoints.length >= 2) {
        const validPoints = trendLinePoints.filter((point, index) => {
          if (index === 0) return true;
          const prevPoint = trendLinePoints[index - 1];
          return prevPoint && point && 
                 !isNaN(prevPoint.x) && !isNaN(prevPoint.y) &&
                 !isNaN(point.x) && !isNaN(point.y);
        });
        
        if (validPoints.length >= 2) {
          trendLinePath = validPoints.reduce((path, point, index) => {
            if (index === 0) {
              return `M ${point.x} ${point.y}`;
            }
            return `${path} L ${point.x} ${point.y}`;
          }, '');
        }
      }
    }
  }

  // Generate nice, rounded grid lines and axis labels
  const xNiceLabels = getNiceLabels(plotXMin, plotXMax, 5);
  const yNiceLabels = getNiceLabels(plotYMin, plotYMax, 5);

  const xGridValues = xNiceLabels.map(value => ({
    value: value,
    pixel: toPixelX(value),
  }));

  const yGridValues = yNiceLabels.map(value => ({
    value: value,
    pixel: toPixelY(value),
  }));

  // Calculate correlation coefficient text
  const correlationValue = (correlation !== null && correlation !== undefined && !isNaN(correlation)) 
    ? correlation 
    : 0;
  const correlationText = (correlationValue !== 0 && correlationValue !== null && correlationValue !== undefined && !isNaN(correlationValue)) ?
    `r = ${correlationValue.toFixed(2)} (${correlationStrength || 'weak'})` :
    'No correlation data';

  return (
    <View style={[styles.container, { width, height }]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.chartContainer}>
        <Svg width={width} height={height}>
          {/* Grid lines */}
          {xGridValues.map((grid, index) => (
            <Line
              key={`x-grid-${index}`}
              x1={grid.pixel}
              y1={padding.top}
              x2={grid.pixel}
              y2={padding.top + chartHeight}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          ))}
          {yGridValues.map((grid, index) => (
            <Line
              key={`y-grid-${index}`}
              x1={padding.left}
              y1={grid.pixel}
              x2={padding.left + chartWidth}
              y2={grid.pixel}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          ))}

          {/* Axes */}
          <Line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke={colors.border}
            strokeWidth={2}
          />
          <Line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke={colors.border}
            strokeWidth={2}
          />

          {/* X-axis title */}
          <SvgText
            x={padding.left + chartWidth / 2}
            y={padding.top + chartHeight + 40}
            fontSize={12}
            fill={colors.textPrimary}
            fontWeight="600"
            textAnchor="middle"
          >
            {xLabel || 'X Variable'}
          </SvgText>

          {/* Y-axis title */}
          <SvgText
            x={padding.left - 45}
            y={padding.top + chartHeight / 2}
            fontSize={12}
            fill={colors.textPrimary}
            fontWeight="600"
            textAnchor="middle"
            transform={`rotate(-90 ${padding.left - 45} ${padding.top + chartHeight / 2})`}
          >
            {yLabel || 'Y Variable'}
          </SvgText>

          {/* X-axis labels */}
          {xGridValues.map((grid, index) => {
            // Show all nice labels, but format them nicely
            const formatValue = (val) => {
              // For large numbers, use comma separators and round appropriately
              if (Math.abs(val) >= 1000) {
                return Math.round(val).toLocaleString();
              } else if (Math.abs(val) >= 1) {
                return val.toFixed(0);
              } else {
                return val.toFixed(1);
              }
            };
            
            return (
              <SvgText
                key={`x-label-${index}`}
                x={grid.pixel}
                y={padding.top + chartHeight + 20}
                fontSize={10}
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {formatValue(grid.value)}
              </SvgText>
            );
          })}

          {/* Y-axis labels */}
          {yGridValues.map((grid, index) => {
            // Format Y-axis values nicely
            const formatValue = (val) => {
              if (Math.abs(val) >= 1000) {
                return Math.round(val).toLocaleString();
              } else if (Math.abs(val) >= 1) {
                return Math.round(val).toString();
              } else {
                return val.toFixed(1);
              }
            };
            
            return (
              <SvgText
                key={`y-label-${index}`}
                x={padding.left - 15}
                y={grid.pixel + 4}
                fontSize={10}
                fill={colors.textSecondary}
                textAnchor="end"
              >
                {formatValue(grid.value)}
              </SvgText>
            );
          })}

          {/* Scatter points */}
          {scatterPoints.map((point, index) => (
            <Circle
              key={`point-${index}`}
              cx={point.pixelX}
              cy={point.pixelY}
              r={4}
              fill={pointColor}
              stroke={colors.cardBackground}
              strokeWidth={1}
              opacity={0.8}
            />
          ))}

          {/* Trend line (line of best fit) - rendered after points so it's visible on top */}
          {trendLinePath && (
            <Path
              key="trend-line"
              d={trendLinePath}
              stroke={trendLineColor}
              strokeWidth={2}
              fill="none"
              opacity={0.8}
              strokeDasharray="5,5"
            />
          )}
        </Svg>
      </View>


      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          n={validData.length} | {correlationText}
        </Text>
      </View>
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
  },
  noDataText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  axisLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.regular,
    marginTop: spacing.xs,
  },
  axisLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  yAxisLabelContainer: {
    alignItems: 'flex-end',
  },
  statsContainer: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  statsText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  trendText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
});

export default ScatterPlot;
