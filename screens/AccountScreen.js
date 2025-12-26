import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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

      // Get insights count
      const { data: insightsData, error: insightsError } = await supabase
        .from('insights_cache')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (insightsError) throw insightsError;

      setStats({
        totalHabits: habitsData?.length || 0,
        loggedHabits: logsData?.length || 0,
        sleepRecords: sleepData?.length || 0,
        insightsGenerated: insightsData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
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
        redirectTo: 'sleepfactor://reset-password',
      });

      if (error) throw error;

      Alert.alert(
        'Password Reset Sent',
        'Check your email for password reset instructions. The link will redirect you back to the app.'
      );
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    Alert.alert(
      'Change Email',
      'Email changes are not yet supported. Please contact support if you need to change your email address.'
    );
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
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email || 'Not available'}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleChangeEmail}
              >
                <Text style={styles.changeButtonText}>Change Email</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

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

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => Alert.alert('Coming Soon', 'Data export feature is coming soon!')}
              >
                <Ionicons name="download-outline" size={24} color={colors.primary} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Export Data</Text>
                  <Text style={styles.actionSubtitle}>Download your data for backup or analysis</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Profile')}
              >
                <Ionicons name="settings-outline" size={24} color={colors.primary} />
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>App Settings</Text>
                  <Text style={styles.actionSubtitle}>Manage notifications and preferences</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
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
    paddingBottom: 100, // Extra padding for navigation bar
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
  actionsContainer: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  actionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  actionSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default AccountScreen;
