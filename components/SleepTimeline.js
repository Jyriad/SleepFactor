import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import CoreSleepInfoModal from './CoreSleepInfoModal';

const SLEEP_BAR_RADIUS = 8;
const CORE_SLEEP_RADIUS = 2;

const SleepTimeline = ({ sleepData, coreSleepDurationMinutes }) => {
  const { formatTime } = useUserPreferences();
  const [showCoreSleepInfo, setShowCoreSleepInfo] = useState(false);

  if (!sleepData) return null;

  // Multiple sessions (e.g. main sleep + nap): show separate bars per session
  const timelineData = useMemo(() => {
    const sessions = sleepData.sleep_sessions;
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      const sessionResults = [];
      for (const sess of sessions) {
        const start = sess.startTime ? new Date(sess.startTime) : null;
        const end = sess.endTime ? new Date(sess.endTime) : null;
        if (!start || !end) continue;
        const totalDurationMinutes = sess.totalMinutes || Math.round((end - start) / (1000 * 60));
        let segments = [];
        if (sess.sleep_stages && sess.sleep_stages.length > 0) {
          const stages = sess.sleep_stages
            .map(stage => ({
              ...stage,
              startTime: new Date(stage.startTime),
              endTime: new Date(stage.endTime),
            }))
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          const totalMs = end.getTime() - start.getTime();
          segments = stages.map(stage => {
            const segmentStartMs = stage.startTime.getTime() - start.getTime();
            const segmentDurationMs = stage.endTime.getTime() - stage.startTime.getTime();
            return {
              type: stage.stage,
              startPercent: (segmentStartMs / totalMs) * 100,
              widthPercent: (segmentDurationMs / totalMs) * 100,
              durationMinutes: stage.durationMinutes || 0,
            };
          });
        } else {
          segments = [{ type: 'light', startPercent: 0, widthPercent: 100, durationMinutes: totalDurationMinutes }];
        }
        sessionResults.push({
          segments,
          sleepStart: start,
          sleepEnd: end,
          totalDurationMinutes,
        });
      }
      if (sessionResults.length === 0) return null;
      const totalAll = sessionResults.reduce((s, r) => s + r.totalDurationMinutes, 0);
      sessionResults.forEach(s => {
        s.widthPercent = totalAll > 0 ? (s.totalDurationMinutes / totalAll) * 100 : 0;
      });
      return {
        multipleSessions: true,
        sessions: sessionResults,
        totalDurationMinutes: sleepData.total_sleep_minutes || totalAll,
      };
    }
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

  if (!timelineData) return null;
  if (!timelineData.multipleSessions && (!timelineData.segments || timelineData.segments.length === 0)) return null;

  const totalDurationMinutes = timelineData.multipleSessions ? timelineData.totalDurationMinutes : timelineData.totalDurationMinutes;
  const showCoreSleep = coreSleepDurationMinutes != null && totalDurationMinutes > 0;
  const coreWidthPercent = showCoreSleep
    ? Math.min(100, (coreSleepDurationMinutes / totalDurationMinutes) * 100)
    : 0;
  const coreSleepDurationLabel = showCoreSleep
    ? (coreSleepDurationMinutes % 60 === 0
        ? `${Math.floor(coreSleepDurationMinutes / 60)}h`
        : `${Math.floor(coreSleepDurationMinutes / 60)}h ${coreSleepDurationMinutes % 60}m`)
    : '';

  const renderOneTimeline = (segments, sleepStart, sleepEnd, keyPrefix) => {
    const startTime = formatTime(sleepStart);
    const endTime = formatTime(sleepEnd);
    return (
      <View key={keyPrefix} style={styles.timelineContainer}>
        <View style={styles.timelineBar}>
          {segments.map((segment, index) => {
            const isFirst = index === 0;
            const isLast = index === segments.length - 1;
            return (
              <View
                key={`${keyPrefix}-${segment.type}-${index}`}
                style={[
                  styles.segment,
                  {
                    position: 'absolute',
                    left: `${segment.startPercent}%`,
                    width: `${segment.widthPercent}%`,
                    backgroundColor: colors.sleepStages[segment.type] || colors.sleepStages.light,
                    borderTopLeftRadius: isFirst && segment.startPercent === 0 ? SLEEP_BAR_RADIUS : 0,
                    borderBottomLeftRadius: isFirst && segment.startPercent === 0 ? SLEEP_BAR_RADIUS : 0,
                    borderTopRightRadius: isLast ? SLEEP_BAR_RADIUS : 0,
                    borderBottomRightRadius: isLast ? SLEEP_BAR_RADIUS : 0,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.moonIcon}>
          <Ionicons name="moon" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.timeLabels}>
          <Text style={styles.timeLabel}>{startTime}</Text>
          <Text style={styles.timeLabel}>{endTime}</Text>
        </View>
      </View>
    );
  };

  // Multiple sessions: two separate pill-shaped bars, side-by-side, proportionally sized with a gap
  const renderMultiSessionBar = () => {
    const { sessions } = timelineData;
    return (
      <View style={styles.timelineContainer}>
        <View style={styles.multiSessionBarsRow}>
          {sessions.map((sess, i) => (
            <View
              key={`session-${i}`}
              style={[
                styles.standaloneSessionBar,
                { flex: sess.totalDurationMinutes },
                i > 0 && styles.standaloneSessionBarGap,
              ]}
            >
              <View style={styles.standaloneSessionBarInner}>
                {sess.segments.map((segment, index) => {
                  const isFirst = index === 0;
                  const isLast = index === sess.segments.length - 1;
                  return (
                    <View
                      key={`s${i}-${segment.type}-${index}`}
                      style={[
                        styles.segment,
                        {
                          position: 'absolute',
                          left: `${segment.startPercent}%`,
                          width: `${segment.widthPercent}%`,
                          backgroundColor: colors.sleepStages[segment.type] || colors.sleepStages.light,
                          borderTopLeftRadius: isFirst && segment.startPercent === 0 ? SLEEP_BAR_RADIUS : 0,
                          borderBottomLeftRadius: isFirst && segment.startPercent === 0 ? SLEEP_BAR_RADIUS : 0,
                          borderTopRightRadius: isLast ? SLEEP_BAR_RADIUS : 0,
                          borderBottomRightRadius: isLast ? SLEEP_BAR_RADIUS : 0,
                        },
                      ]}
                    />
                  );
                })}
              </View>
              {i === 0 && (
                <View style={styles.moonIcon}>
                  <Ionicons name="moon" size={14} color="#FFFFFF" />
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={styles.multiSessionTimeLabels}>
          {sessions.map((sess, i) => (
            <View
              key={`labels-${i}`}
              style={[
                styles.multiSessionLabelCell,
                { flex: sess.totalDurationMinutes },
                i > 0 && styles.standaloneSessionBarGap,
                i === sessions.length - 1 && styles.multiSessionLabelCellLast,
              ]}
            >
              <Text style={styles.timeLabel}>
                {formatTime(sess.sleepStart)} – {formatTime(sess.sleepEnd)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {showCoreSleep && (
        <View style={styles.coreSleepBlock}>
          <View style={styles.coreSleepLabelRow}>
            <View style={styles.coreSleepLabelWithHelp}>
              <Text style={styles.coreSleepLabel}>Core sleep</Text>
              <TouchableOpacity
                onPress={() => setShowCoreSleepInfo(true)}
                style={styles.coreSleepHelpButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="help-circle-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.coreSleepDuration}>{coreSleepDurationLabel}</Text>
          </View>
          <View style={styles.coreSleepBarWrap}>
            <View style={styles.coreSleepBar}>
              <View
                style={[
                  styles.coreSleepFill,
                  coreWidthPercent >= 100 && styles.coreSleepFillFull,
                  { width: `${coreWidthPercent}%` },
                ]}
              />
              <View style={[styles.coreSleepRest, { width: `${100 - coreWidthPercent}%` }]} />
            </View>
            <View style={[styles.coreSleepBookend, styles.coreSleepBookendLeft]} />
            <View style={[styles.coreSleepBookend, styles.coreSleepBookendRight, { left: `${coreWidthPercent}%` }]} />
          </View>
        </View>
      )}

      {timelineData.multipleSessions
        ? renderMultiSessionBar()
        : renderOneTimeline(timelineData.segments, timelineData.sleepStart, timelineData.sleepEnd, 'single')}

      <CoreSleepInfoModal visible={showCoreSleepInfo} onClose={() => setShowCoreSleepInfo(false)} />
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
    overflow: 'visible',
  },
  timelineBar: {
    height: 40,
    borderRadius: SLEEP_BAR_RADIUS,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.accent,
    position: 'relative',
    alignItems: 'stretch',
  },
  multiSessionBarsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.sm,
  },
  standaloneSessionBar: {
    height: 40,
    borderRadius: SLEEP_BAR_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.accent,
    position: 'relative',
    minWidth: 40,
  },
  standaloneSessionBarGap: {
    marginLeft: 4,
  },
  standaloneSessionBarInner: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  sessionSection: {
    overflow: 'hidden',
    position: 'relative',
  },
  sessionSectionInner: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
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
  coreSleepBlock: {
    marginBottom: spacing.sm,
  },
  coreSleepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: spacing.xs,
  },
  coreSleepLabelWithHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  coreSleepLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  coreSleepHelpButton: {
    padding: 2,
  },
  coreSleepDuration: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  coreSleepBarWrap: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreSleepBar: {
    width: '100%',
    flexDirection: 'row',
    height: 3,
    borderRadius: CORE_SLEEP_RADIUS,
    overflow: 'hidden',
  },
  coreSleepFill: {
    height: '100%',
    backgroundColor: colors.primary,
    opacity: 0.9,
    borderTopLeftRadius: CORE_SLEEP_RADIUS,
    borderBottomLeftRadius: CORE_SLEEP_RADIUS,
  },
  coreSleepFillFull: {
    borderTopRightRadius: CORE_SLEEP_RADIUS,
    borderBottomRightRadius: CORE_SLEEP_RADIUS,
  },
  coreSleepRest: {
    height: '100%',
    backgroundColor: 'transparent',
    minWidth: 0,
  },
  coreSleepBookend: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: colors.primary,
    borderRadius: CORE_SLEEP_RADIUS,
  },
  coreSleepBookendLeft: {
    left: 0,
  },
  coreSleepBookendRight: {
    // left set inline as percentage
  },
  multiSessionTimeLabels: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  multiSessionLabelCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    overflow: 'visible',
  },
  multiSessionLabelCellLast: {
    justifyContent: 'flex-end',
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
