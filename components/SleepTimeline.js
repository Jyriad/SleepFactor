import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

// Sleep stage colors
const SLEEP_COLORS = {
  deep: '#1E3A8A',      // Dark blue for deep sleep
  light: '#60A5FA',     // Light blue for light sleep
  rem: '#A78BFA',       // Purple for REM sleep
  awake: '#FBBF24',     // Amber for awake periods
};

const SleepTimeline = ({ sleepData }) => {
  if (!sleepData) return null;

  const {
    deep_sleep_minutes = 0,
    light_sleep_minutes = 0,
    rem_sleep_minutes = 0,
    awake_minutes = 0,
    total_sleep_minutes = 0,
  } = sleepData;

  // Calculate total time (sleep + awake)
  const totalTime = total_sleep_minutes + awake_minutes;
  if (totalTime === 0) return null;

  // Calculate percentages for each stage
  const deepPercent = (deep_sleep_minutes / totalTime) * 100;
  const lightPercent = (light_sleep_minutes / totalTime) * 100;
  const remPercent = (rem_sleep_minutes / totalTime) * 100;
  const awakePercent = (awake_minutes / totalTime) * 100;

  // Format time for display (HH:MM)
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Estimate sleep start and end times (we don't have exact times, so we'll use estimates)
  // For display purposes, we'll show a typical 8-hour window starting around 22:00
  const estimatedStartHour = 22;
  const estimatedStartMinute = 0;
  const estimatedEndHour = Math.floor((estimatedStartHour * 60 + totalTime) / 60) % 24;
  const estimatedEndMinute = ((estimatedStartHour * 60 + totalTime) % 60) % 60;

  const startTime = `${String(estimatedStartHour).padStart(2, '0')}:${String(estimatedStartMinute).padStart(2, '0')}`;
  const endTime = `${String(estimatedEndHour).padStart(2, '0')}:${String(estimatedEndMinute).padStart(2, '0')}`;

  // Build segments array in a typical sleep cycle order
  // Typical pattern: Light -> Deep -> REM (cycling), with awake periods
  const segments = [];
  
  // Add segments only if they have duration
  if (light_sleep_minutes > 0) {
    segments.push({ type: 'light', percent: lightPercent, minutes: light_sleep_minutes });
  }
  if (deep_sleep_minutes > 0) {
    segments.push({ type: 'deep', percent: deepPercent, minutes: deep_sleep_minutes });
  }
  if (rem_sleep_minutes > 0) {
    segments.push({ type: 'rem', percent: remPercent, minutes: rem_sleep_minutes });
  }
  if (awake_minutes > 0) {
    segments.push({ type: 'awake', percent: awakePercent, minutes: awake_minutes });
  }

  // Arrange segments in a typical sleep cycle pattern
  // Start with light sleep, then deep, then REM, with awake periods interspersed
  const orderedSegments = [];
  
  // Add light sleep first (typically how sleep starts)
  const lightSegment = segments.find(s => s.type === 'light');
  if (lightSegment) orderedSegments.push(lightSegment);
  
  // Then deep sleep (usually occurs in first half of night)
  const deepSegment = segments.find(s => s.type === 'deep');
  if (deepSegment) orderedSegments.push(deepSegment);
  
  // Then REM (more common in second half)
  const remSegment = segments.find(s => s.type === 'rem');
  if (remSegment) orderedSegments.push(remSegment);
  
  // Awake periods (can occur anywhere, but we'll show at end for simplicity)
  const awakeSegment = segments.find(s => s.type === 'awake');
  if (awakeSegment) orderedSegments.push(awakeSegment);

  return (
    <View style={styles.container}>
      {/* Timeline Bar */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineBar}>
          {orderedSegments.map((segment, index) => {
            const isFirst = index === 0;
            const isLast = index === orderedSegments.length - 1;
            return (
              <View
                key={`${segment.type}-${index}`}
                style={[
                  styles.segment,
                  {
                    width: `${segment.percent}%`,
                    backgroundColor: SLEEP_COLORS[segment.type],
                    borderTopLeftRadius: isFirst ? 16 : 0,
                    borderBottomLeftRadius: isFirst ? 16 : 0,
                    borderTopRightRadius: isLast ? 16 : 0,
                    borderBottomRightRadius: isLast ? 16 : 0,
                  },
                ]}
              />
            );
          })}
        </View>
        {/* Moon icon at start - only show if we have segments */}
        {orderedSegments.length > 0 && (
          <View style={styles.moonIcon}>
            <Ionicons name="moon" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Time Labels */}
      <View style={styles.timeLabels}>
        <Text style={styles.timeLabel}>{startTime}</Text>
        <Text style={styles.timeLabel}>{endTime}</Text>
      </View>

      {/* Legend - Simplified, just show the stages */}
      <View style={styles.legend}>
        {orderedSegments.map((segment, index) => (
          <View key={`legend-${segment.type}-${index}`} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: SLEEP_COLORS[segment.type] },
              ]}
            />
            <Text style={styles.legendText}>
              {segment.type === 'deep' ? 'Deep' :
               segment.type === 'light' ? 'Light' :
               segment.type === 'rem' ? 'REM' : 'Awake'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  timelineContainer: {
    marginBottom: spacing.sm,
    position: 'relative',
  },
  timelineBar: {
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#E0E7FF', // Light blue background for the bar
  },
  segment: {
    height: '100%',
  },
  moonIcon: {
    position: 'absolute',
    left: 8,
    top: 12,
    zIndex: 1,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  timeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});

export default SleepTimeline;

