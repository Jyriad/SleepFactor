import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

const AccountScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState({
    totalHabits: 0,
    loggedHabits: 0,
    sleepRecords: 0,
    insightsGenerated: 0,
  });

  useEffect(() => {
    loadUserStats();
  }, [user]);

  const loadUserStats = async () => {
    if (!user) return;

    try {
      // Get total habits count
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (habitsError) throw habitsError;

      // Get habit logs count
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (logsError) throw logsError;

      // Get sleep records count
      const { data: sleepData, error: sleepError } = await supabase
        .from('sleep_data')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (sleepError) throw sleepError;

      // Calculate insights count: count habits with 10+ log entries
      const { data: habitLogs, error: insightsError } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id);

      if (insightsError) {
        throw insightsError;
      }

      // Count how many times each habit has been logged
      const habitCounts = {};
      habitLogs.forEach(log => {
        habitCounts[log.habit_id] = (habitCounts[log.habit_id] || 0) + 1;
      });

      // Count habits with 10+ logs (minimum for insights)
      const insightsCount = Object.values(habitCounts).filter(count => count >= 10).length;

      const finalStats = {
        totalHabits: habitsData?.length || 0,
        loggedHabits: logsData?.length || 0,
        sleepRecords: sleepData?.length || 0,
        insightsGenerated: insightsCount,
      };

      setStats(finalStats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load account statistics');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'No email address found for this account');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
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
      const { error } = await supabase.auth.deleteUser();
      if (error) throw error;
      setShowDeleteModal(false);
      // Auth state change will automatically navigate to login screen
    } catch (error) {
      console.log('Delete account error:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const StatCard = ({ title, value, icon, color = colors.primary }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

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

          {/* Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Activity</Text>
            <View style={styles.statsGrid}>
              <StatCard
                title="Habits Tracked"
                value={stats.totalHabits}
                icon="list"
                color={colors.primary}
              />
              <StatCard
                title="Habits Logged"
                value={stats.loggedHabits}
                icon="checkmark-circle"
                color="#10B981"
              />
              <StatCard
                title="Sleep Records"
                value={stats.sleepRecords}
                icon="moon"
                color="#8B5CF6"
              />
              <StatCard
                title="Insights Generated"
                value={stats.insightsGenerated}
                icon="analytics"
                color="#F59E0B"
              />
            </View>
          </View>

          {/* Delete Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delete Account</Text>
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
  infoCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statTitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
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
});

export default AccountScreen;
