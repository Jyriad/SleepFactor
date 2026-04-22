import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import { clearConsumptionOptionsDiskCache } from '../services/consumptionOptionsService';
import accountDeletionService from '../services/accountDeletionService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import AuthProviderBadges from '../components/AuthProviderBadges';
import { getAccountIdentifier, getLinkedIdentityProviders } from '../utils/authDisplay';

const HABIT_LOGS_PAGE = 1000;

/** Count habits that have at least minLogs rows (paginates past Supabase 1000-row cap). */
async function countHabitsWithMinLogs(userId, minLogs = 10) {
  const habitCounts = {};
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .range(from, from + HABIT_LOGS_PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      habitCounts[row.habit_id] = (habitCounts[row.habit_id] || 0) + 1;
    }
    if (data.length < HABIT_LOGS_PAGE) break;
    from += HABIT_LOGS_PAGE;
  }
  return Object.values(habitCounts).filter((c) => c >= minLogs).length;
}

const AccountScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  /** Fresh user from server so identities match Supabase dashboard (session cache can omit them). */
  const [resolvedUser, setResolvedUser] = useState(user);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState({
    totalHabits: 0,
    loggedHabits: 0,
    sleepRecords: 0,
    insightsGenerated: 0,
  });

  useEffect(() => {
    setResolvedUser(user);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled || error || !data?.user) return;
        setResolvedUser(data.user);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    loadUserStats();
  }, [user]);

  const accountUser = resolvedUser || user;

  const clearUserCaches = async (userId) => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const habitLogKeys = keys.filter((key) => key.startsWith(`habitLogs_${userId}_`));
      const consumptionEventKeys = keys.filter((key) => key.startsWith(`consumptionEvents_${userId}_`));
      const habitLoggingCacheKeys = keys.filter(
        (key) => key === `habits_${userId}` || key === `habitLogCountsByValue_${userId}`
      );
      const toRemove = [...habitLogKeys, ...consumptionEventKeys, ...habitLoggingCacheKeys];
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
      await clearConsumptionOptionsDiskCache();
      await homeCacheService.clearForUser(userId);
    } catch (_e) {
      /* non-fatal */
    }
  };

  const loadUserStats = async () => {
    if (!user) return;

    try {
      // Use head:true so counts are exact (selecting rows is capped at 1000 — see Learnings.mdc)
      const { count: habitsCount, error: habitsError } = await supabase
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (habitsError) throw habitsError;

      const { count: logsCount, error: logsError } = await supabase
        .from('habit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (logsError) throw logsError;

      const { count: sleepCount, error: sleepError } = await supabase
        .from('sleep_data')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (sleepError) throw sleepError;

      const insightsCount = await countHabitsWithMinLogs(user.id, 10);

      setStats({
        totalHabits: habitsCount ?? 0,
        loggedHabits: logsCount ?? 0,
        sleepRecords: sleepCount ?? 0,
        insightsGenerated: insightsCount,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load account statistics');
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
              await loadUserStats();
              Alert.alert('Success', `Deleted ${deletedCount} sleep data records`);
            } catch (_e) {
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
              if (user?.id) await clearUserCaches(user.id);
              await loadUserStats();
              Alert.alert('Success', `Deleted ${deletedCount} habit records and cleared caches`);
            } catch (_e) {
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
              if (user?.id) await clearUserCaches(user.id);
              await loadUserStats();
              Alert.alert('Success', `Deleted ${sleepDeleted} sleep records and ${habitDeleted} habit records`);
            } catch (_e) {
              Alert.alert('Error', 'Failed to delete all data');
            }
          },
        },
      ]
    );
  };

  const handlePasswordReset = async () => {
    const emailForReset = accountUser?.email;
    if (!emailForReset) {
      Alert.alert('Error', 'No email address found for this account');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailForReset, {
        redirectTo: 'sleepfactor://reset-password'
      });

      if (error) throw error;

      Alert.alert(
        'Password Reset Sent',
        'Check your email for password reset instructions. The link will open the app to complete your password reset. If you don\'t have the app installed, you can reset your password on the web.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await accountDeletionService.deleteCurrentUserAccount();
      await clearConsumptionOptionsDiskCache();
      await accountDeletionService.clearLocalAuthSessionAfterDeletion();
      setShowDeleteModal(false);
      // Auth state change will automatically navigate to login screen
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Sign-in & contact (matches Supabase-style provider display) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account details</Text>
            <View style={styles.infoCard}>
              <View>
                <Text style={styles.infoLabel}>Email or phone</Text>
                <Text style={styles.accountPrimaryValue} selectable>
                  {getAccountIdentifier(accountUser) || '—'}
                </Text>
              </View>
              {getLinkedIdentityProviders(accountUser).length > 0 && (
                <View style={styles.accountSignInBlock}>
                  <Text style={styles.infoLabel}>Sign-in methods</Text>
                  <AuthProviderBadges
                    user={accountUser}
                    style={{ marginTop: spacing.xs }}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Account Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Security</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Password</Text>
                <Text style={styles.infoValue}>••••••••</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handlePasswordReset}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.changeButtonText}>Reset Password</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Statistics — same card + typography language as Profile / Insights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your activity</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="albums-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.activityLabel}>Habits you track</Text>
                <Text style={styles.activityValue}>{stats.totalHabits}</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.activityLabel}>Habit logs</Text>
                <Text style={styles.activityValue}>{stats.loggedHabits}</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="moon-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.activityLabel}>Nights with sleep data</Text>
                <Text style={styles.activityValue}>{stats.sleepRecords}</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="analytics-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.activityLabelBlock}>
                  <Text style={styles.activityLabel}>Habits with insights</Text>
                  <Text style={styles.activityHint}>10+ logs each</Text>
                </View>
                <Text style={styles.activityValue}>{stats.insightsGenerated}</Text>
              </View>
            </View>
          </View>

          {/* Delete data — nested to reduce accidental taps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delete data</Text>
            <Text style={styles.sectionDescription}>
              Remove sleep data, habit logs, or everything from our servers. This cannot be undone.
            </Text>
            <Button
              title="Delete data"
              onPress={() => setShowDeleteDataModal(true)}
              variant="destructive"
              style={styles.deleteDataButton}
            />
          </View>

          {/* Delete Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delete account</Text>
            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => setShowDeleteModal(true)}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={24} color={colors.white} />
                  <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showDeleteDataModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteDataModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDeleteDataModal(false)}>
          <View style={styles.deleteDataModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.deleteDataModalContent}>
                <Text style={styles.deleteDataModalTitle}>What do you want to delete?</Text>
                <Text style={styles.deleteDataModalDescription}>
                  All options permanently remove data and cannot be undone.
                </Text>
                <TouchableOpacity
                  style={styles.deleteDataOption}
                  onPress={() => {
                    setShowDeleteDataModal(false);
                    handleDeleteSleepData();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteDataOptionText}>Sleep data only</Text>
                  <Text style={styles.deleteDataOptionSubtext}>All synced sleep records</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteDataOption}
                  onPress={() => {
                    setShowDeleteDataModal(false);
                    handleDeleteHabitLogs();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteDataOptionText}>Habit logs only</Text>
                  <Text style={styles.deleteDataOptionSubtext}>All habit tracking data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteDataOption}
                  onPress={() => {
                    setShowDeleteDataModal(false);
                    handleDeleteAllData();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteDataOptionText}>All data</Text>
                  <Text style={styles.deleteDataOptionSubtext}>Sleep records and habit logs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteDataCancelButton}
                  onPress={() => setShowDeleteDataModal(false)}
                >
                  <Text style={styles.deleteDataCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable onPress={() => !deleting && setShowDeleteModal(false)} style={StyleSheet.absoluteFill} />
          <Pressable style={styles.modalContainer}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Delete Account</Text>
                <TouchableOpacity
                  onPress={() => !deleting && setShowDeleteModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <View style={styles.modalWarningIcon}>
                  <Ionicons name="warning" size={48} color={colors.error} />
                </View>
                <Text style={styles.modalWarningText}>
                  Are you sure you want to delete your account?
                </Text>
                <Text style={styles.modalDescription}>
                  This decision is irreversible. All your data including habits, sleep records, and insights will be permanently deleted and cannot be recovered.
                </Text>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={() => !deleting && setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.modalDeleteButton]}
                  onPress={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalDeleteButtonText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40, // Match back button width for centering
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
    paddingBottom: 120, // Space so bottom content clears the navigation footer
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
  sectionDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.regular,
    lineHeight: 20,
  },
  deleteDataButton: {
    marginTop: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountSignInBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountPrimaryValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  infoValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  changeButtonText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  activityCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  activityDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  activityLabelBlock: {
    flex: 1,
  },
  activityHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: typography.weights.regular,
  },
  activityValue: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    minWidth: 36,
    textAlign: 'right',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 0,
  },
  deleteAccountButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.regular,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalContent: {
    padding: spacing.regular,
    alignItems: 'center',
  },
  modalWarningIcon: {
    marginBottom: spacing.regular,
  },
  modalWarningText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.regular,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
  },
  modalDeleteButton: {
    backgroundColor: colors.error,
  },
  modalDeleteButtonText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  deleteDataModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteDataModalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '90%',
    maxWidth: 350,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteDataModalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  deleteDataModalDescription: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  deleteDataOption: {
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: spacing.sm,
  },
  deleteDataOptionText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  deleteDataOptionSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteDataCancelButton: {
    marginTop: spacing.regular,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  deleteDataCancelButtonText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});

export default AccountScreen;
