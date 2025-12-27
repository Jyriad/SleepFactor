import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const SleepTimeline = ({ sleepData }) => {
  const { formatTime } = useUserPreferences();

  if (!sleepData) return null;

  // Use actual sleep stage intervals if available, otherwise fall back to aggregated data
  const timelineData = useMemo(() => {
    if (sleepData.sleep_stages && Array.isArray(sleepData.sleep_stages) && sleepData.sleep_stages.length > 0) {
      // We have actual interval data - use it!
      const stages = sleepData.sleep_stages
        .map(stage => ({
          ...stage,
          startTime: new Date(stage.startTime),
          endTime: new Date(stage.endTime),
        }))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Find the actual sleep start and end times
      const sleepStart = stages[0]?.startTime;
      const sleepEnd = stages[stages.length - 1]?.endTime;

      if (!sleepStart || !sleepEnd) return null;

      const totalDurationMs = sleepEnd.getTime() - sleepStart.getTime();
      const totalDurationMinutes = Math.round(totalDurationMs / (1000 * 60));

      // Calculate segments with actual positions
      const segments = stages.map(stage => {
        const segmentStartMs = stage.startTime.getTime() - sleepStart.getTime();
        const segmentDurationMs = stage.endTime.getTime() - stage.startTime.getTime();
        const segmentStartPercent = (segmentStartMs / totalDurationMs) * 100;
        const segmentWidthPercent = (segmentDurationMs / totalDurationMs) * 100;

        return {
          type: stage.stage,
          startPercent: segmentStartPercent,
          widthPercent: segmentWidthPercent,
          startTime: stage.startTime,
          endTime: stage.endTime,
          durationMinutes: stage.durationMinutes,
        };
      });

      return {
        segments,
        sleepStart,
        sleepEnd,
        totalDurationMinutes,
      };
    } else {
      // Fall back to aggregated data (for HealthKit or manual entries)
      const {
        deep_sleep_minutes = 0,
        light_sleep_minutes = 0,
        rem_sleep_minutes = 0,
        awake_minutes = 0,
        total_sleep_minutes = 0,
        sleep_start_time, // Try to use actual sleep session start time
        sleep_end_time,   // Try to use actual sleep session end time
      } = sleepData;

      const totalTime = total_sleep_minutes + awake_minutes;
      if (totalTime === 0) return null;

      let sleepStart, sleepEnd;

      // Use actual sleep session times if available
      if (sleep_start_time && sleep_end_time) {
        sleepStart = new Date(sleep_start_time);
        sleepEnd = new Date(sleep_end_time);
      } else {
        // Estimate start time when we don't have exact data
        // Calculate backwards from the sleep date to estimate when sleep might have started
        const sleepDate = new Date(sleepData.date);
        sleepEnd = new Date(sleepDate);
        sleepEnd.setHours(8, 0, 0, 0); // Assume wake up at 8 AM

        sleepStart = new Date(sleepEnd);
        sleepStart.setMinutes(sleepStart.getMinutes() - totalTime); // Subtract total sleep time
      }

      // Build segments from aggregated data
      const segments = [];
      let currentPercent = 0;

      if (light_sleep_minutes > 0) {
        const percent = (light_sleep_minutes / totalTime) * 100;
        segments.push({
          type: 'light',
          startPercent: currentPercent,
          widthPercent: percent,
          durationMinutes: light_sleep_minutes,
        });
        currentPercent += percent;
      }

      if (deep_sleep_minutes > 0) {
        const percent = (deep_sleep_minutes / totalTime) * 100;
        segments.push({
          type: 'deep',
          startPercent: currentPercent,
          widthPercent: percent,
          durationMinutes: deep_sleep_minutes,
        });
        currentPercent += percent;
      }

      if (rem_sleep_minutes > 0) {
        const percent = (rem_sleep_minutes / totalTime) * 100;
        segments.push({
          type: 'rem',
          startPercent: currentPercent,
          widthPercent: percent,
          durationMinutes: rem_sleep_minutes,
        });
        currentPercent += percent;
      }

      if (awake_minutes > 0) {
        const percent = (awake_minutes / totalTime) * 100;
        segments.push({
          type: 'awake',
          startPercent: currentPercent,
          widthPercent: percent,
          durationMinutes: awake_minutes,
        });
      }

      return {
        segments,
        sleepStart,
        sleepEnd,
        totalDurationMinutes: totalTime,
      };
    }
  }, [sleepData]);

  if (!timelineData || timelineData.segments.length === 0) return null;

  const { segments, sleepStart, sleepEnd } = timelineData;
  const startTime = formatTime(sleepStart);
  const endTime = formatTime(sleepEnd);

  // Get unique stage types for legend
  const uniqueStages = Array.from(new Set(segments.map(s => s.type)));

  return (
    <View style={styles.container}>
      {/* Timeline Bar */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineBar}>
          {segments.map((segment, index) => {
            const isFirst = index === 0;
            const isLast = index === segments.length - 1;
            return (
              <View
                key={`${segment.type}-${index}`}
                style={[
                  styles.segment,
                  {
                    position: 'absolute',
                    left: `${segment.startPercent}%`,
                    width: `${segment.widthPercent}%`,
                    backgroundColor: colors.sleepStages[segment.type],
                    borderTopLeftRadius: isFirst && segment.startPercent === 0 ? 20 : 0,
                    borderBottomLeftRadius: isFirst && segment.startPercent === 0 ? 20 : 0,
                    borderTopRightRadius: isLast ? 20 : 0,
                    borderBottomRightRadius: isLast ? 20 : 0,
                  },
                ]}
              />
            );
          })}
        </View>
        {/* Moon icon at start */}
        <View style={styles.moonIcon}>
          <Ionicons name="moon" size={14} color="#FFFFFF" />
        </View>
      </View>

      {/* Time Labels */}
      <View style={styles.timeLabels}>
        <Text style={styles.timeLabel}>{startTime}</Text>
        <Text style={styles.timeLabel}>{endTime}</Text>
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
    position: 'relative',
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
});

export default SleepTimeline;
