import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/auth';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import useHealthSync from '../hooks/useHealthSync';
import sleepDataService from '../services/sleepDataService';

const ProfileScreen = () => {
  const { user } = useAuth();
  const {
    hasPermissions,
    isInitialized,
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
              Alert.alert('Success', `Deleted ${deletedCount} habit log records`);
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
              Alert.alert('Success', `Deleted ${sleepDeleted} sleep records and ${habitDeleted} habit logs`);
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* User Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{user?.email || 'Not available'}</Text>
            </View>
          </View>

          {/* Data Connections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Connections</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Sleep Data Source</Text>
              <Text style={styles.value}>{getDataSourceDisplay(hasPermissions)}</Text>
            </View>
            {hasPermissions && (
              <Button
                title="Disconnect"
                onPress={handleDisconnect}
                variant="secondary"
                style={styles.disconnectButton}
              />
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

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Notifications</Text>
              <Text style={styles.value}>Coming soon</Text>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Version</Text>
              <Text style={styles.value}>{Constants.expoConfig?.version || '1.0.34'}</Text>
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
  disconnectButton: {
    marginTop: spacing.regular,
  },
  logoutButton: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
});

export default ProfileScreen;

