import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import dataQualityService from '../services/dataQualityService';
import sleepDataService from '../services/sleepDataService';
import { supabase } from '../services/supabase';
import SleepTimeline from './SleepTimeline';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Habit Item Component - handles different habit types and expandable details
const HabitItem = ({ habitItem, isExpanded, onToggle }) => {
  const formatConsumptionTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Unknown time';
    }
  };

  const formatValue = (value, type, unit) => {
    if (value === null || value === undefined) return 'N/A';

    switch (type) {
      case 'time':
        const hours = Math.floor(value / 60);
        const minutes = Math.round(value % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      case 'numeric':
        return unit ? `${value} ${unit}` : value.toString();
      case 'quick_consumption':
        return unit ? `${value} ${unit}` : value.toString();
      default:
        return value.toString();
    }
  };

  // Special handling for bedtime levels (drug levels)
  if (habitItem.displayType === 'bedtime_level') {
    return (
      <View style={styles.habitItem}>
        <View style={styles.habitHeader}>
          <View style={styles.habitNameContainer}>
            <Text style={styles.habitName}>{habitItem.habits?.name || 'Unknown Habit'}</Text>
            <Text style={styles.bedtimeLabel}>Bedtime Level</Text>
          </View>
          {habitItem.consumptionEvents && habitItem.consumptionEvents.length > 0 && (
            <TouchableOpacity onPress={onToggle} style={styles.expandButton}>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bedtimeLevelContainer}>
          <Text style={styles.bedtimeLevel}>
            {habitItem.numeric_value?.toFixed(1) || '0'} {habitItem.unit || ''}
          </Text>
          <Text style={styles.bedtimeDescription}>
            Remaining at bedtime (half-life: {habitItem.habits?.half_life_hours || '?'} hours)
          </Text>
        </View>

        {isExpanded && habitItem.consumptionEvents && habitItem.consumptionEvents.length > 0 && (
          <View style={styles.consumptionBreakdown}>
            <Text style={styles.breakdownTitle}>Consumption Breakdown:</Text>
            {habitItem.consumptionEvents.map((event, idx) => (
              <View key={event.id || idx} style={styles.consumptionItem}>
                <Text style={styles.consumptionTime}>
                  {formatConsumptionTime(event.consumed_at)}
                </Text>
                <Text style={styles.consumptionAmount}>
                  {event.amount} {event.unit || ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Regular habit items
  return (
    <View style={styles.habitItem}>
      <View style={styles.habitHeader}>
        <Text style={styles.habitName}>{habitItem.habits?.name || 'Unknown Habit'}</Text>
        <Text style={styles.habitTime}>
          {habitItem.source === 'consumption' || habitItem.source === 'consumption_fallback'
            ? formatConsumptionTime(habitItem.consumed_at)
            : 'Logged'
          }
        </Text>
      </View>
      <Text style={styles.habitValue}>
        {formatValue(
          habitItem.numeric_value || habitItem.value,
          habitItem.habits?.type,
          habitItem.habits?.unit || habitItem.unit
        )}
      </Text>
    </View>
  );
};

const DataPointDetailModal = ({
  visible,
  onClose,
  point,
  habit,
  sleepMetric,
  onExclusionComplete,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exclusionStatus, setExclusionStatus] = useState(null);
  const [exclusionReason, setExclusionReason] = useState(null);
  const [sleepData, setSleepData] = useState(null);
  const [habitsData, setHabitsData] = useState([]);
  const [expandedHabits, setExpandedHabits] = useState(new Set());

  useEffect(() => {
    if (visible && point) {
      checkExclusionStatus();
      fetchSleepData();
      fetchHabitsData();
    }
  }, [visible, point]);

  const checkExclusionStatus = async () => {
    if (!point) return;

    try {
      // Use the data already available in the point object
      if (point.habitLog && point.sleepData) {
        // This is habit data with both habit log and sleep data
        setExclusionStatus({
          excluded: point.exclude_from_insights,
          reason: point.exclusion_reason,
          autoExcluded: point.auto_excluded,
          logId: point.habitLog.id
        });
      } else if (point.sleepData) {
        // This is sleep data
        setExclusionStatus({
          excluded: point.sleepData.exclude_from_insights,
          reason: point.sleepData.exclusion_reason,
          autoExcluded: point.sleepData.auto_excluded
        });
      } else {
        setExclusionStatus({ excluded: false, reason: null, autoExcluded: false });
      }
    } catch (error) {
      setExclusionStatus({ excluded: false, reason: null, autoExcluded: false });
    }
  };

  const fetchSleepData = async () => {
    if (!point || !point.date) return;

    try {
      const data = await sleepDataService.getSleepDataForDate(point.date);
      setSleepData(data);
    } catch (error) {
      setSleepData(null);
    }
  };

  const fetchHabitsData = async () => {
    if (!point || !point.date || !user) return;

    try {
      // First, get drug levels for quick_consumption habits (these show bedtime levels)
      const { data: drugLevels, error: drugError } = await supabase
        .from('drug_levels')
        .select(`
          *,
          habits!inner(name, type, unit, is_active, half_life_hours)
        `)
        .eq('user_id', user.id)
        .eq('date', point.date);

      if (drugError) {
        // Continue without drug levels
      }

      // Get regular habit logs for this date (non-quick_consumption habits)
      const { data: habitLogs, error } = await supabase
        .from('habit_logs')
        .select(`
          *,
          habits!inner(name, type, unit, is_active)
        `)
        .eq('user_id', user.id)
        .eq('date', point.date)
        .neq('habits.type', 'quick_consumption') // Exclude quick_consumption (handled by drug_levels)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get consumption events for quick_consumption habits (for detailed breakdown)
      const { data: consumptionEvents, error: consumptionError } = await supabase
        .from('habit_consumption_events')
        .select(`
          *,
          habits!inner(name, type, unit, is_active)
        `)
        .eq('user_id', user.id)
        .gte('consumed_at', `${point.date}T00:00:00.000Z`)
        .lt('consumed_at', `${point.date}T23:59:59.999Z`);

      if (consumptionError) {
        // Continue without consumption events
      }

      // Combine all habits data with proper prioritization
      const allHabitsData = [];

      // Add drug levels first (quick_consumption habits) - these show bedtime levels
      if (drugLevels) {
        drugLevels.forEach(level => {
          allHabitsData.push({
            ...level,
            source: 'drug_level',
            value: `${level.level_value?.toFixed(1) || '0'} ${level.unit || ''}`.trim(),
            numeric_value: level.level_value,
            displayType: 'bedtime_level',
            consumptionEvents: consumptionEvents?.filter(event =>
              event.habit_id === level.habit_id
            ) || []
          });
        });
      }

      // Add regular habit logs
      if (habitLogs) {
        habitLogs.forEach(log => {
          allHabitsData.push({
            ...log,
            source: 'habit_log'
          });
        });
      }

      // Add any quick_consumption habits that don't have drug levels (fallback)
      if (consumptionEvents) {
        const processedHabitIds = new Set(drugLevels?.map(level => level.habit_id) || []);

        consumptionEvents.forEach(event => {
          if (!processedHabitIds.has(event.habit_id)) {
            // This quick_consumption habit doesn't have a calculated level
            allHabitsData.push({
              ...event,
              source: 'consumption_fallback',
              value: `${event.amount || ''} ${event.unit || ''}`.trim(),
              numeric_value: event.amount
            });
          }
        });
      }

      setHabitsData(allHabitsData);
    } catch (error) {
      setHabitsData([]);
    }
  };

  const handleExclusionToggle = async () => {
    if (!point || !exclusionStatus) return;

    const isSleepData = !habit;
    const currentlyExcluded = exclusionStatus.excluded;

    // Show confirmation dialog
    const action = currentlyExcluded ? 'include' : 'exclude';
    const confirmMessage = currentlyExcluded
      ? `Include this ${isSleepData ? 'sleep data' : 'habit log'} back into insights calculations?`
      : `Exclude this ${isSleepData ? 'sleep data' : 'habit log'} from insights calculations?`;

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Data Point`,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlyExcluded ? 'Include' : 'Exclude',
          style: currentlyExcluded ? 'default' : 'destructive',
          onPress: async () => {
            if (!currentlyExcluded) {
              // Need to get exclusion reason for exclusion
              const reason = await getExclusionReason();
              if (reason === null) return; // User cancelled
              await performExclusion(reason);
            } else {
              // Including data back
              await performInclusion();
            }
          }
        }
      ]
    );
  };

  const getExclusionReason = () => {
    return new Promise((resolve) => {
      const reasons = [
        'Statistical outlier',
        'Unusual circumstances',
        'Data entry error',
        'Device/app issue',
        'Incomplete data',
        'Travel day',
        'Illness',
        'Irregular schedule',
        'Other'
      ];

      Alert.alert(
        'Reason for Exclusion',
        'Why are you excluding this data?',
        reasons.map(reason => ({
          text: reason,
          onPress: () => resolve(reason)
        })).concat({
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null)
        })
      );
    });
  };

  const performExclusion = async (reason) => {
    setLoading(true);
    try {
      let result;
      if (!habit) {
        // Sleep data exclusion
        result = await dataQualityService.excludeSleepData(user.id, point.date, reason);
      } else {
        // Habit log exclusion
        result = await dataQualityService.excludeHabitLog(user.id, exclusionStatus.logId, reason);
      }

      if (result.success) {
        setExclusionStatus(prev => ({
          ...prev,
          excluded: true,
          reason: reason,
          autoExcluded: false
        }));

        if (onExclusionComplete) {
          onExclusionComplete();
        }

        Alert.alert('Success', 'Data point excluded from insights');
      } else {
        Alert.alert('Error', result.error || 'Failed to exclude data point');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to exclude data point');
    } finally {
      setLoading(false);
    }
  };

  const performInclusion = async () => {
    setLoading(true);
    try {
      let result;
      if (!habit) {
        // Sleep data inclusion
        result = await dataQualityService.includeData(user.id, 'sleep_data', point.date);
      } else {
        // Habit log inclusion
        result = await dataQualityService.includeData(user.id, 'habit_logs', exclusionStatus.logId);
      }

      if (result.success) {
        setExclusionStatus(prev => ({
          ...prev,
          excluded: false,
          reason: null,
          autoExcluded: false
        }));

        if (onExclusionComplete) {
          onExclusionComplete();
        }

        Alert.alert('Success', 'Data point included back in insights');
      } else {
        Alert.alert('Error', result.error || 'Failed to include data point');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to include data point');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatValue = (value, type, unit) => {
    if (value === null || value === undefined) return 'N/A';

    switch (type) {
      case 'time':
        const hours = Math.floor(value / 60);
        const minutes = Math.round(value % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      case 'numeric':
        return unit ? `${value} ${unit}` : value.toString();
      case 'binary':
        return value && (value.toLowerCase() === 'yes' || value === '1' || value === true) ? 'Yes' : 'No';
      default:
        return value.toString();
    }
  };

  const getStatusColor = () => {
    if (!exclusionStatus) return colors.textSecondary;
    if (exclusionStatus.excluded) {
      return exclusionStatus.autoExcluded ? colors.warning : colors.error;
    }
    return colors.success;
  };

  const getStatusText = () => {
    if (!exclusionStatus) return 'Loading...';
    if (exclusionStatus.excluded) {
      return exclusionStatus.autoExcluded ? 'Auto-excluded' : 'Manually excluded';
    }
    return 'Included in insights';
  };

  if (!point) return null;

  const isSleepData = !habit;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Data Point Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Date */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Date</Text>
              <Text style={styles.sectionValue}>{formatDate(point.date)}</Text>
            </View>

            {/* Values */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {habit ? habit.name : 'Sleep Data'}
              </Text>
              <Text style={styles.sectionValue}>
                {habit
                  ? formatValue(point.x, habit.type, habit.unit)
                  : formatValue(point.x, 'numeric', 'minutes')
                }
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {sleepMetric.label}
              </Text>
              <Text style={styles.sectionValue}>
                {formatValue(point.y, 'numeric', sleepMetric.unit)}
              </Text>
            </View>

            {/* Status */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Analysis Status</Text>
              <View style={styles.statusContainer}>
                <Ionicons
                  name={exclusionStatus?.excluded ? 'eye-off' : 'eye'}
                  size={16}
                  color={getStatusColor()}
                />
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
            </View>

            {/* Exclusion Reason */}
            {exclusionStatus?.excluded && exclusionStatus?.reason && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Reason</Text>
                <Text style={styles.reasonText}>{exclusionStatus.reason}</Text>
              </View>
            )}

            {/* Sleep Timeline */}
            {sleepData && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Sleep Timeline</Text>
                <View style={styles.timelineContainer}>
                  <SleepTimeline sleepData={sleepData} />
                </View>
              </View>
            )}

            {/* Habits Logged */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Habits Logged ({habitsData.length})
              </Text>
              {habitsData.length > 0 ? (
                <View style={styles.habitsList}>
                  {habitsData.map((habitItem, index) => (
                    <HabitItem
                      key={`${habitItem.source}-${habitItem.id || index}`}
                      habitItem={habitItem}
                      isExpanded={expandedHabits.has(`${habitItem.source}-${habitItem.id || index}`)}
                      onToggle={() => {
                        const key = `${habitItem.source}-${habitItem.id || index}`;
                        setExpandedHabits(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(key)) {
                            newSet.delete(key);
                          } else {
                            newSet.add(key);
                          }
                          return newSet;
                        });
                      }}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.noHabitsText}>No habits logged for this day</Text>
              )}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={onClose}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.primaryButton,
                exclusionStatus?.excluded ? styles.includeButton : styles.excludeButton,
                loading && styles.disabledButton
              ]}
              onPress={handleExclusionToggle}
              disabled={loading}
            >
              {loading ? (
                <Text style={styles.primaryButtonText}>Processing...</Text>
              ) : (
                <Text style={styles.primaryButtonText}>
                  {exclusionStatus?.excluded ? 'Include in Analysis' : 'Exclude from Analysis'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9, // Increased to accommodate more content
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.regular,
  },
  section: {
    marginBottom: spacing.regular,
  },
  sectionLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  sectionValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  reasonText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.regular,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.regular,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  primaryButton: {
    paddingVertical: spacing.regular,
  },
  primaryButtonText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  excludeButton: {
    backgroundColor: colors.error,
  },
  includeButton: {
    backgroundColor: colors.success,
  },
  disabledButton: {
    opacity: 0.6,
  },
  timelineContainer: {
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitsList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  habitItem: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  habitTime: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  habitValue: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  noHabitsText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  habitNameContainer: {
    flex: 1,
  },
  bedtimeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs / 2,
  },
  expandButton: {
    padding: spacing.xs,
  },
  bedtimeLevelContainer: {
    marginTop: spacing.xs,
  },
  bedtimeLevel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  bedtimeDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
    lineHeight: 16,
  },
  consumptionBreakdown: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  consumptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs / 2,
  },
  consumptionTime: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  consumptionAmount: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
});

export default DataPointDetailModal;