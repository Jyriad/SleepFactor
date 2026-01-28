import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dynamic version from app config - automatically synced with build version
const BASE_VERSION = Constants.expoConfig?.version || '1.0.0';
// Check if this is a dev build using multiple methods for reliability:
// 1. Check app name (works for EAS builds)
// 2. Check bundle identifier (works for both EAS and local dev client builds)
// 3. Check __DEV__ flag (React Native global, true in development)
const appName = Constants.expoConfig?.name;
const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || Constants.expoConfig?.android?.package;
const IS_DEV_BUILD = 
  appName === "SleepFactor Dev" || 
  bundleId?.includes('.dev') || 
  (typeof __DEV__ !== 'undefined' && __DEV__);
// Append " Dev" if it's a dev build but version doesn't already have it
const APP_VERSION = IS_DEV_BUILD && !BASE_VERSION.includes(' Dev') 
  ? `${BASE_VERSION} Dev` 
  : BASE_VERSION;
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { signOut } from '../services/auth';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import NavigationCard from '../components/NavigationCard';
import useHealthSync from '../hooks/useHealthSync';
import sleepDataService from '../services/sleepDataService';
import bedtimeHabitsService from '../services/bedtimeHabitsService';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { preferences, updatePreference } = useUserPreferences();

  // Clear user-specific cached data from AsyncStorage
  const clearUserCaches = async (userId) => {
    try {
      // Get all AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();

      // Filter for user-specific habit log caches
      const habitLogKeys = keys.filter(key =>
        key.startsWith(`habitLogs_${userId}_`)
      );

      // Remove all user habit log caches
      if (habitLogKeys.length > 0) {
        await AsyncStorage.multiRemove(habitLogKeys);
      }
    } catch (error) {
    }
  };
  const {
    hasPermissions,
    isInitialized,
    isLoading,
    performSync,
  } = useHealthSync();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const getDataSourceDisplay = (hasPermissions) => {
    if (!isInitialized) return 'Initializing...';
    if (!hasPermissions) return 'Not connected';

    // Determine platform
    const platform = require('react-native').Platform.OS;
    return platform === 'android' ? 'Health Connect' : 'Apple Health';
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Data Source',
      'This will revoke access to your health data. You can reconnect anytime by granting permissions again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              // For now, we'll just clear the permissions state
              // In a real implementation, we'd call the revokePermissions method
              Alert.alert(
                'Disconnect Instructions',
                'To disconnect from your health data source, please revoke permissions in your device settings:\n\n' +
                '• Android: Health Connect app → Settings → Connected apps\n' +
                '• iOS: Settings → Privacy & Security → Health → SleepFactor'
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect');
            }
          },
        },
      ]
    );
  };

  const handleSyncData = async () => {
    try {
      const result = await performSync({
        daysBack: 30,
        userId: user.id,
        force: true
      });

      if (result.success) {
        const syncedRecords = result.syncedRecords || 0;
        
        // After successful sleep data sync, backfill bedtime habits
        try {
          await bedtimeHabitsService.backfillBedtimeHabits(user.id, 30);
        } catch (bedtimeError) {
          // Don't fail the entire sync if bedtime habits backfill fails
          console.log('Bedtime habits backfill error:', bedtimeError);
        }
        
        Alert.alert(
          'Sync Complete',
          `Successfully synced 30 days of sleep data and health metrics.\n\nSynced ${syncedRecords} records.\n\nBedtime habits have been updated.`
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to sync data');
      }
    } catch (error) {
      Alert.alert('Sync Error', 'An unexpected error occurred during sync');
    }
  };

  const handleDeleteSleepData = () => {
    Alert.alert(
      'Delete All Sleep Data',
      'This will permanently delete all your sleep data from our servers. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await sleepDataService.deleteAllSleepData();
              Alert.alert('Success', `Deleted ${deletedCount} sleep data records`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete sleep data');
            }
          },
        },
      ]
    );
  };

  const handleDeleteHabitLogs = () => {
    Alert.alert(
      'Delete All Habit Logs',
      'This will permanently delete all your habit tracking data from our servers. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await sleepDataService.deleteAllHabitLogs();
              // Clear cached data
              await clearUserCaches(user.id);
              Alert.alert('Success', `Deleted ${deletedCount} habit records and cleared caches`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete habit logs');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete ALL your data (sleep records and habit logs) from our servers. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const sleepDeleted = await sleepDataService.deleteAllSleepData();
              const habitDeleted = await sleepDataService.deleteAllHabitLogs();
              // Clear cached data
              await clearUserCaches(user.id);
              Alert.alert('Success', `Deleted ${sleepDeleted} sleep records and ${habitDeleted} habit records`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete all data');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.content}>
          {/* Account Navigation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <NavigationCard
              icon="person"
              title="Account Details"
              subtitle="Manage password and view account statistics"
              onPress={() => navigation.navigate('Account')}
            />
          </View>

          {/* Data Connections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Connections</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Sleep Data Source</Text>
              <Text style={styles.value}>{getDataSourceDisplay(hasPermissions)}</Text>
            </View>
            {hasPermissions && (
              <>
                <Button
                  title="Sync 30 Days of Data"
                  onPress={handleSyncData}
                  loading={isLoading}
                  style={styles.syncButton}
                />
                <Button
                  title="Disconnect"
                  onPress={handleDisconnect}
                  variant="secondary"
                  style={styles.disconnectButton}
                />
              </>
            )}
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>
            <Text style={styles.sectionDescription}>
              Permanently delete your data from our servers
            </Text>
            <View style={styles.dataManagementContainer}>
              <Button
                title="Delete Sleep Data"
                onPress={handleDeleteSleepData}
                variant="secondary"
                style={styles.dataButton}
              />
              <Button
                title="Delete Habit Logs"
                onPress={handleDeleteHabitLogs}
                variant="secondary"
                style={styles.dataButton}
              />
              <Button
                title="Delete All Data"
                onPress={handleDeleteAllData}
                variant="secondary"
                style={styles.dataButton}
              />
            </View>
          </View>

          {/* Data Quality */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Quality</Text>
            <Text style={styles.sectionDescription}>
              Control how your data is used for insights calculation
            </Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Outlier Detection Sensitivity</Text>
              <Text style={styles.description}>
                How aggressively to detect and exclude anomalous data points
              </Text>
              <View style={styles.sensitivityContainer}>
                <TouchableOpacity
                  style={[
                    styles.sensitivityOption,
                    preferences.outlierSensitivity === 'conservative' && styles.sensitivityOptionSelected,
                  ]}
                  onPress={() => updatePreference('outlierSensitivity', 'conservative')}
                >
                  <Text
                    style={[
                      styles.sensitivityText,
                      preferences.outlierSensitivity === 'conservative' && styles.sensitivityTextSelected,
                    ]}
                  >
                    Conservative
                  </Text>
                  <Text style={styles.sensitivityDescription}>Exclude less data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sensitivityOption,
                    preferences.outlierSensitivity === 'standard' && styles.sensitivityOptionSelected,
                  ]}
                  onPress={() => updatePreference('outlierSensitivity', 'standard')}
                >
                  <Text
                    style={[
                      styles.sensitivityText,
                      preferences.outlierSensitivity === 'standard' && styles.sensitivityTextSelected,
                    ]}
                  >
                    Standard
                  </Text>
                  <Text style={styles.sensitivityDescription}>Balanced approach</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sensitivityOption,
                    preferences.outlierSensitivity === 'aggressive' && styles.sensitivityOptionSelected,
                  ]}
                  onPress={() => updatePreference('outlierSensitivity', 'aggressive')}
                >
                  <Text
                    style={[
                      styles.sensitivityText,
                      preferences.outlierSensitivity === 'aggressive' && styles.sensitivityTextSelected,
                    ]}
                  >
                    Aggressive
                  </Text>
                  <Text style={styles.sensitivityDescription}>Exclude more data</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.infoCard, styles.toggleCard]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.label}>Auto-Exclude Outliers</Text>
                  <Text style={styles.description}>
                    Automatically exclude detected outliers from insights
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    preferences.autoExcludeOutliers && styles.toggleSwitchOn,
                  ]}
                  onPress={() => updatePreference('autoExcludeOutliers', !preferences.autoExcludeOutliers)}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      preferences.autoExcludeOutliers && styles.toggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.infoCard, styles.toggleCard]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.label}>Show Habits Without Significance</Text>
                  <Text style={styles.description}>
                    Show habits with "no statistical significance yet" to help debug data issues
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    preferences.showNoSignificanceHabits && styles.toggleSwitchOn,
                  ]}
                  onPress={() => updatePreference('showNoSignificanceHabits', !preferences.showNoSignificanceHabits)}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      preferences.showNoSignificanceHabits && styles.toggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Time Format</Text>
              <View style={styles.timeFormatContainer}>
                <TouchableOpacity
                  style={[
                    styles.timeFormatOption,
                    preferences.timeFormat === '12' && styles.timeFormatOptionSelected,
                  ]}
                  onPress={() => updatePreference('timeFormat', '12')}
                >
                  <Text
                    style={[
                      styles.timeFormatText,
                      preferences.timeFormat === '12' && styles.timeFormatTextSelected,
                    ]}
                  >
                    12 Hour
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.timeFormatOption,
                    preferences.timeFormat === '24' && styles.timeFormatOptionSelected,
                  ]}
                  onPress={() => updatePreference('timeFormat', '24')}
                >
                  <Text
                    style={[
                      styles.timeFormatText,
                      preferences.timeFormat === '24' && styles.timeFormatTextSelected,
                    ]}
                  >
                    24 Hour
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.infoCard, styles.notificationsCard]}>
              <Text style={styles.label}>Notifications</Text>
              <Text style={styles.value}>Coming soon</Text>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Version</Text>
              <View style={styles.versionContainer}>
                <Text style={styles.value}>{APP_VERSION}</Text>
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="secondary"
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 72, // Account for bottom navigation bar height (60px) + positioning (0px) + extra buffer
  },
  content: {
    paddingHorizontal: spacing.regular,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  infoCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  developmentBadge: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.error,
    backgroundColor: colors.error + '20', // Semi-transparent red background
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
  },
  dataManagementContainer: {
    gap: spacing.sm,
  },
  dataButton: {
    marginBottom: spacing.sm,
  },
  syncButton: {
    marginTop: spacing.regular,
  },
  disconnectButton: {
    marginTop: spacing.regular,
  },
  logoutButton: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  notificationsCard: {
    marginTop: spacing.md,
  },
  timeFormatContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  timeFormatOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  timeFormatOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeFormatText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  timeFormatTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.weights.medium,
  },
  sensitivityContainer: {
    marginTop: spacing.xs,
  },
  sensitivityOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  sensitivityOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sensitivityText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  sensitivityTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.weights.medium,
  },
  sensitivityDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  toggleCard: {
    marginTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: spacing.regular,
  },
  description: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: {
    transform: [{ translateX: 22 }],
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  developmentBadge: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.error,
    backgroundColor: colors.error + '20', // Semi-transparent red background
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default ProfileScreen;

