import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import useHealthSync from '../hooks/useHealthSync';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getToday, isSameDay, formatDateTitle, getDatesArray, isToday, formatTimeAgo } from '../utils/dateHelpers';
import DateSelector from '../components/DateSelector';
import HabitSummaryCard from '../components/HabitSummaryCard';
import DatePickerModal from '../components/DatePickerModal';
import NavigationCard from '../components/NavigationCard';
import HealthConnectPrompt from '../components/HealthConnectPrompt';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [habitsLogged, setHabitsLogged] = useState(false);
  const [todaysHabitsLogged, setTodaysHabitsLogged] = useState(false);
  const [loggedDates, setLoggedDates] = useState([]);
  const [habitCount, setHabitCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  // Sleep data state
  const [sleepData, setSleepData] = useState(null);
  const [sleepDataLoading, setSleepDataLoading] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // Health sync hook
  const {
    isInitialized: healthSyncInitialized,
    isLoading: healthSyncLoading,
    hasPermissions,
    needsPermissions,
    lastSyncResult,
    error: syncError,
    performSync,
    requestPermissions,
    getLastSyncTimestamp,
    clearError,
    resetNeedsPermissions,
  } = useHealthSync();

  useFocusEffect(
    React.useCallback(() => {
      checkHabitsLogged();
      checkTodaysHabitsLogged();
    }, [selectedDate, user])
  );

  useEffect(() => {
    checkHabitsLogged();
    checkTodaysHabitsLogged();
    fetchLoggedDates();
  }, [selectedDate, user]);

  useEffect(() => {
    fetchHabitCount();
    fetchSleepData();
  }, [selectedDate, user]);

  // Check permissions and show prompt if needed
  useEffect(() => {
    if (healthSyncInitialized && needsPermissions && !hasPermissions) {
      setShowPermissionPrompt(true);
    }
  }, [healthSyncInitialized, needsPermissions, hasPermissions]);

  const checkHabitsLogged = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .limit(1);

      if (error) throw error;

      setHabitsLogged(data && data.length > 0);
    } catch (error) {
      console.error('Error checking habits logged:', error);
      setHabitsLogged(false);
    } finally {
      setLoading(false);
    }
  };

  const checkTodaysHabitsLogged = async () => {
    if (!user) return;

    try {
      const today = getToday();
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .limit(1);

      if (error) throw error;

      setTodaysHabitsLogged(data && data.length > 0);
    } catch (error) {
      console.error('Error checking today\'s habits logged:', error);
      setTodaysHabitsLogged(false);
    }
  };

  const fetchLoggedDates = async () => {
    if (!user) return;

    try {
      const dates = getDatesArray();
      const dateStrings = dates.map(d => d.date);

      const { data, error } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', user.id)
        .in('date', dateStrings);

      if (error) throw error;

      // Get unique dates that have logs
      const loggedDateSet = new Set(data?.map(log => log.date) || []);
      setLoggedDates(Array.from(loggedDateSet));
    } catch (error) {
      console.error('Error fetching logged dates:', error);
      setLoggedDates([]);
    }
  };

  const fetchHabitCount = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('date', selectedDate);

      if (error) throw error;

      setHabitCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching habit count:', error);
      setHabitCount(0);
    }
  };

  const fetchSleepData = async () => {
    if (!user) return;

    setSleepDataLoading(true);
    try {
      const data = await sleepDataService.getSleepDataForDate(selectedDate);
      setSleepData(data);
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      setSleepData(null);
    } finally {
      setSleepDataLoading(false);
    }
  };

  const handleLogHabits = () => {
    navigation.navigate('HabitLogging', { date: selectedDate });
  };

  const handleLogTodaysHabits = () => {
    const today = getToday();
    setSelectedDate(today);
    navigation.navigate('HabitLogging', { date: today });
  };

  const handleCalendarDateSelect = (date) => {
    setSelectedDate(date);
    navigation.navigate('HabitLogging', { date });
  };

  const handleSyncNow = async () => {
    try {
      clearError();
      const result = await performSync({ force: true });
      if (result.success) {
        // Refresh sleep data for current date
        await fetchSleepData();
        Alert.alert('Success', `Synced ${result.syncedRecords} sleep records`);
      }
    } catch (error) {
      Alert.alert('Sync Failed', error.message || 'Unable to sync sleep data');
    }
  };

  const handlePermissionsGranted = () => {
    setShowPermissionPrompt(false);
    resetNeedsPermissions();
    // Auto-sync after permissions are granted
    handleSyncNow();
  };

  const handleDismissPermissions = () => {
    setShowPermissionPrompt(false);
  };

  const formatSleepDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getDataSourceDisplay = (source) => {
    switch (source) {
      case 'health_connect':
        return 'Health Connect';
      case 'healthkit':
        return 'Apple Health';
      case 'manual':
        return 'Manual Entry';
      default:
        return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{formatDateTitle(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => setCalendarModalVisible(true)}
            style={styles.calendarIconButton}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          loggedDates={loggedDates}
        />

        {/* Today's Habits Reminder - Always show if not logged */}
        {!loading && !todaysHabitsLogged && (
          <View style={styles.todayReminder}>
            <View style={styles.todayReminderHeader}>
              <Ionicons name="warning" size={20} color="#F97316" />
              <Text style={styles.todayReminderText}>
                You haven't logged your habits for today
              </Text>
            </View>
            <TouchableOpacity
              style={styles.todayReminderButton}
              onPress={handleLogTodaysHabits}
            >
              <Text style={styles.todayReminderButtonText}>Log Today's Habits</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Habit Summary Card */}
        {!loading && (
          <HabitSummaryCard
            date={selectedDate}
            habitCount={habitCount}
            onPress={handleLogHabits}
          />
        )}


        {/* Sleep Data Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sleep Data</Text>
            {healthSyncInitialized && (
              <TouchableOpacity
                onPress={handleSyncNow}
                disabled={healthSyncLoading}
                style={styles.syncButton}
              >
                <Ionicons
                  name={healthSyncLoading ? "sync" : "refresh-outline"}
                  size={20}
                  color={healthSyncLoading ? colors.textSecondary : colors.primary}
                />
                <Text style={[
                  styles.syncButtonText,
                  { color: healthSyncLoading ? colors.textSecondary : colors.primary }
                ]}>
                  {healthSyncLoading ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {showPermissionPrompt ? (
            <HealthConnectPrompt
              onPermissionsGranted={handlePermissionsGranted}
              onDismiss={handleDismissPermissions}
            />
          ) : sleepDataLoading ? (
            <View style={styles.sleepCard}>
              <View style={styles.sleepCardHeader}>
                <Ionicons name="moon-outline" size={24} color={colors.primary} />
                <Text style={styles.sleepCardTitle}>Loading sleep data...</Text>
              </View>
            </View>
          ) : sleepData ? (
            <View style={styles.sleepCard}>
              <View style={styles.sleepCardHeader}>
                <Ionicons name="moon-outline" size={24} color={colors.primary} />
                <Text style={styles.sleepCardTitle}>
                  {isToday(selectedDate) ? "Last Night's Sleep" : `Sleep on ${formatDateTitle(selectedDate)}`}
                </Text>
                <View style={styles.dataSourceBadge}>
                  <Text style={styles.dataSourceText}>
                    {getDataSourceDisplay(sleepData.source)}
                  </Text>
                </View>
              </View>

              <View style={styles.sleepMetrics}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Total Sleep</Text>
                  <Text style={styles.metricValue}>
                    {formatSleepDuration(sleepData.total_sleep_minutes)}
                  </Text>
                </View>

                {sleepData.deep_sleep_minutes > 0 && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Deep Sleep</Text>
                    <Text style={styles.metricValue}>
                      {formatSleepDuration(sleepData.deep_sleep_minutes)}
                    </Text>
                  </View>
                )}

                {sleepData.light_sleep_minutes > 0 && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Light Sleep</Text>
                    <Text style={styles.metricValue}>
                      {formatSleepDuration(sleepData.light_sleep_minutes)}
                    </Text>
                  </View>
                )}

                {sleepData.rem_sleep_minutes > 0 && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>REM Sleep</Text>
                    <Text style={styles.metricValue}>
                      {formatSleepDuration(sleepData.rem_sleep_minutes)}
                    </Text>
                  </View>
                )}

                {sleepData.awake_minutes > 0 && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Awake Time</Text>
                    <Text style={styles.metricValue}>
                      {formatSleepDuration(sleepData.awake_minutes)}
                    </Text>
                  </View>
                )}

                {sleepData.awakenings_count > 0 && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Awakenings</Text>
                    <Text style={styles.metricValue}>
                      {sleepData.awakenings_count}
                    </Text>
                  </View>
                )}

                {sleepData.sleep_score && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Sleep Score</Text>
                    <Text style={styles.metricValue}>
                      {sleepData.sleep_score}/100
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.placeholderCard}>
              <Ionicons name="moon-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>
                {hasPermissions ? 'No sleep data available for this date' : 'Connect your health app to view sleep data'}
              </Text>
              <Text style={styles.placeholderSubtext}>
                {hasPermissions
                  ? 'Try syncing or check a different date'
                  : 'Grant permissions to sync sleep data from your device'
                }
              </Text>
              {!hasPermissions && (
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={() => setShowPermissionPrompt(true)}
                >
                  <Text style={styles.connectButtonText}>Connect Health App</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Sync Status */}
          {lastSyncResult && (
            <View style={styles.syncStatus}>
              <Ionicons
                name={lastSyncResult.success ? "checkmark-circle" : "close-circle"}
                size={16}
                color={lastSyncResult.success ? colors.success : colors.error}
              />
              <Text style={[
                styles.syncStatusText,
                { color: lastSyncResult.success ? colors.success : colors.error }
              ]}>
                {lastSyncResult.success
                  ? `Synced ${lastSyncResult.syncedRecords} records ${getLastSyncTimestamp() ? formatTimeAgo(getLastSyncTimestamp()) : ''}`
                  : 'Sync failed'
                }
              </Text>
            </View>
          )}

          {syncError && (
            <View style={styles.errorStatus}>
              <Ionicons name="warning" size={16} color={colors.error} />
              <Text style={styles.errorStatusText}>{syncError}</Text>
            </View>
          )}
        </View>

        {/* Navigation Cards */}
        <View style={styles.section}>
          <NavigationCard
            icon="list"
            title="Manage Your Habits"
            subtitle="Control what habits you want to track"
            onPress={() => navigation.navigate('Habits')}
          />
          <NavigationCard
            icon="chatbubbles"
            title="Sleep Insights"
            subtitle="Discover what affects your sleep"
            onPress={() => navigation.navigate('Insights')}
          />
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={handleCalendarDateSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  calendarIconButton: {
    padding: spacing.xs,
  },
  todayReminder: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    marginHorizontal: spacing.regular,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  todayReminderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  todayReminderButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    alignSelf: 'center',
  },
  todayReminderButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  placeholderCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.regular,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    marginBottom: spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  syncButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  sleepCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  sleepCardTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  dataSourceBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  dataSourceText: {
    fontSize: typography.sizes.xs,
    color: '#FFFFFF',
    fontWeight: typography.weights.medium,
  },
  sleepMetrics: {
    gap: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.regular,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  syncStatusText: {
    fontSize: typography.sizes.small,
    marginLeft: spacing.xs,
  },
  errorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  errorStatusText: {
    fontSize: typography.sizes.small,
    color: colors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
});

export default HomeScreen;

