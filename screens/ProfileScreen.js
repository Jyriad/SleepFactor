import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  appName === "Dev SleepFactor" ||
  appName === "SleepFactor Dev" ||
  bundleId?.includes('.dev') ||
  (typeof __DEV__ !== 'undefined' && __DEV__);
// Append " Dev" if it's a dev build but version doesn't already have it
const APP_VERSION = IS_DEV_BUILD && !BASE_VERSION.includes(' Dev') 
  ? `${BASE_VERSION} Dev` 
  : BASE_VERSION;
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { signOut } from '../services/auth';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import Button from '../components/Button';
import NavigationCard from '../components/NavigationCard';
import AuthProviderBadges from '../components/AuthProviderBadges';
import { getAccountIdentifier } from '../utils/authDisplay';
import useHealthSync from '../hooks/useHealthSync';
import sleepSyncService from '../services/sleepSyncService';
import sleepDataService from '../services/sleepDataService';
import habitReminderNotifications from '../services/habitReminderNotifications';
import homeCacheService from '../services/homeCacheService';
import insightsService from '../services/insightsService';
import { clearConsumptionOptionsDiskCache } from '../services/consumptionOptionsService';
import bedtimeHabitsService from '../services/bedtimeHabitsService';
import { supabase } from '../services/supabase';
/** Square mark: Cotton Blue on dark bars; use SquareLogoDark / SquareLogoLight on light surfaces (Blue Zodiac). */
import SquareLogoDark from '../assets/SquareLogoDark.svg';
import GlassChromeBar from '../components/GlassChromeBar';
import { applyAndroidStatusBarForFrostedHeader } from '../utils/androidStatusBar';
import { Picker } from 'react-native-wheel-pick';

const DEFAULT_CAFFEINE_HALF_LIFE = 5;
const DEFAULT_ALCOHOL_HALF_LIFE = 5;

/** Format "HH:mm" to display string using 12 or 24 hour preference. */
function formatReminderTimeForDisplay(timeStr, use24Hour) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return timeStr || '20:00';
  const [h, m] = timeStr.split(':').map(Number);
  if (use24Hour) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Constants.statusBarHeight ?? 24);
  const headerTopPadding = Math.max(spacing.regular, topInset);
  const navigation = useNavigation();
  const { user } = useAuth();
  /** Server user so linked providers show on the Account card (same as Supabase dashboard). */
  const [resolvedProfileUser, setResolvedProfileUser] = useState(user);
  const { preferences, updatePreference, savePreferences } = useUserPreferences();

  useEffect(() => {
    setResolvedProfileUser(user);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled || error || !data?.user) return;
        setResolvedProfileUser(data.user);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const accountForProfile = resolvedProfileUser || user;

  const [caffeineHalfLife, setCaffeineHalfLife] = useState('');
  const [alcoholHalfLife, setAlcoholHalfLife] = useState('');
  const [caffeineHabitId, setCaffeineHabitId] = useState(null);
  const [alcoholHabitId, setAlcoholHabitId] = useState(null);
  const [halfLifeSaving, setHalfLifeSaving] = useState(false);
  const [habitReminderEnabled, setHabitReminderEnabled] = useState(false);
  const [habitReminderTime, setHabitReminderTime] = useState('20:00');
  const [showHabitReminderTimePicker, setShowHabitReminderTimePicker] = useState(false);
  const [reminderPickerHour, setReminderPickerHour] = useState(20);
  const [reminderPickerMinute, setReminderPickerMinute] = useState(0);
  const [sleepDataModalVisible, setSleepDataModalVisible] = useState(false);
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [marketingToggleSaving, setMarketingToggleSaving] = useState(false);

  const habitReminderHourData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0'),
  })), []);
  const habitReminderMinuteData = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    value: i.toString(),
    label: i.toString().padStart(2, '0'),
  })), []);

  // Load habit reminder preferences
  useEffect(() => {
    habitReminderNotifications.getHabitReminderEnabled().then(setHabitReminderEnabled);
    habitReminderNotifications.getHabitReminderTime().then(setHabitReminderTime);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('marketing_email_opt_in')
        .eq('id', user.id)
        .single();
      if (cancelled || error) return;
      setMarketingEmailOptIn(data?.marketing_email_opt_in === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fetch Caffeine & Alcohol habits for half-life settings
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('id, name, half_life_hours')
        .eq('user_id', user.id)
        .eq('type', 'quick_consumption')
        .in('name', ['Caffeine', 'Alcohol']);
      if (error) return;
      (data || []).forEach((h) => {
        const val = h.half_life_hours != null ? String(h.half_life_hours) : '';
        if (h.name === 'Caffeine') {
          setCaffeineHabitId(h.id);
          setCaffeineHalfLife(val || String(DEFAULT_CAFFEINE_HALF_LIFE));
        } else if (h.name === 'Alcohol') {
          setAlcoholHabitId(h.id);
          setAlcoholHalfLife(val || String(DEFAULT_ALCOHOL_HALF_LIFE));
        }
      });
    })();
  }, [user?.id]);

  const saveHalfLife = async (habitId, value, setDisplay) => {
    if (!habitId || !user?.id) return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 0.5 || num > 24) return;
    setHalfLifeSaving(true);
    try {
      const { error } = await supabase
        .from('habits')
        .update({ half_life_hours: num })
        .eq('id', habitId)
        .eq('user_id', user.id);
      if (error) throw error;
      setDisplay(String(num));
    } catch (e) {
      Alert.alert('Error', 'Could not save half-life. Try again.');
    } finally {
      setHalfLifeSaving(false);
    }
  };

  useEffect(() => {
    applyAndroidStatusBarForFrostedHeader();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      applyAndroidStatusBarForFrostedHeader();
    }, [])
  );

  // Clear user-specific cached data from AsyncStorage
  const clearUserCaches = async (userId) => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const habitLogKeys = keys.filter(key =>
        key.startsWith(`habitLogs_${userId}_`)
      );
      const consumptionEventKeys = keys.filter(key =>
        key.startsWith(`consumptionEvents_${userId}_`)
      );
      const habitLoggingCacheKeys = keys.filter(key =>
        key === `habits_${userId}` || key === `habitLogCountsByValue_${userId}`
      );
      const toRemove = [...habitLogKeys, ...consumptionEventKeys, ...habitLoggingCacheKeys];
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
      await clearConsumptionOptionsDiskCache();
      await homeCacheService.clearForUser(userId);
      await insightsService.clearInsightsDiskCacheForUser(userId);
    } catch (error) {
    }
  };
  const {
    hasPermissions,
    isInitialized,
    isLoading,
    performSync,
    requestPermissions,
    refreshPermissionState,
  } = useHealthSync();

  useFocusEffect(
    React.useCallback(() => {
      refreshPermissionState();
    }, [refreshPermissionState])
  );

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
            if (user?.id) await clearUserCaches(user.id);
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const getDataSourceDisplay = (connected) => {
    if (!isInitialized) return 'Initializing...';
    if (!connected) return 'Not connected — tap for options';
    return Platform.OS === 'android' ? 'Google Health Connect' : 'Apple Health';
  };

  const openSystemPermissions = async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      Alert.alert('Settings', 'Open Settings manually and find SleepFactor to manage permissions.');
    }
  };

  const handleSleepDataSourcePress = () => {
    refreshPermissionState();
    setSleepDataModalVisible(true);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect data source',
      'This will revoke in-app access to your sleep data. You may also remove access in system settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await sleepSyncService.disconnect();
              if (result.success) {
                await refreshPermissionState();
                Alert.alert(
                  'System settings',
                  Platform.OS === 'android'
                    ? 'To fully remove access: open Health Connect → App permissions → SleepFactor.'
                    : 'To fully remove access: Settings → Privacy & Security → Health → SleepFactor.'
                );
              } else {
                Alert.alert('Could not disconnect', result.error || 'Please try again.');
              }
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
        daysBack: 100,
        userId: user.id,
        force: true
      });

      if (result.success) {
        const syncedRecords = result.syncedRecords || 0;
        
        // After successful sleep data sync, backfill bedtime habits for same range
        try {
          await bedtimeHabitsService.backfillBedtimeHabits(user.id, 100);
        } catch (bedtimeError) {
          // Don't fail the entire sync if bedtime habits backfill fails
        }
        
        Alert.alert(
          'Sync Complete',
          `Successfully synced all available sleep data (last 100 days) and health metrics.\n\nSynced ${syncedRecords} records.\n\nBedtime habits have been updated.`
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to sync data');
      }
    } catch (error) {
      Alert.alert('Sync Error', 'An unexpected error occurred during sync');
    }
  };

  const handleToggleMarketingEmails = async () => {
    if (!user?.id || marketingToggleSaving) return;
    const nextValue = !marketingEmailOptIn;
    setMarketingEmailOptIn(nextValue);
    setMarketingToggleSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('users')
        .update({
          marketing_email_opt_in: nextValue,
          marketing_consent_source: 'app_profile',
          marketing_consent_updated_at: nowIso,
          marketing_unsubscribed_at: nextValue ? null : nowIso,
        })
        .eq('id', user.id);
      if (error) throw error;
    } catch (error) {
      setMarketingEmailOptIn(!nextValue);
      Alert.alert('Could not update email preference', 'Please try again.');
    } finally {
      setMarketingToggleSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <GlassChromeBar style={styles.headerGlassOuter}>
          <View style={{ paddingTop: headerTopPadding }}>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <SquareLogoDark
                  width={40}
                  height={40}
                  style={styles.headerLogo}
                  accessibilityLabel="SleepFactor"
                />
                <Text style={styles.title}>Profile</Text>
              </View>
            </View>
          </View>
        </GlassChromeBar>
        <View style={styles.content}>
          {/* Account Navigation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <NavigationCard
              icon="person"
              title="Account Details"
              subtitle={
                getAccountIdentifier(accountForProfile) ||
                'Open for email, sign-in methods, and statistics'
              }
              bottomContent={
                <View>
                  <AuthProviderBadges user={accountForProfile} compact />
                  <Text style={styles.accountCardHint}>
                    Manage password and view account statistics
                  </Text>
                </View>
              }
              onPress={() => navigation.navigate('Account')}
            />
          </View>

          {/* Data Connections — single entry; sync / disconnect / permissions inside modal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Connections</Text>
            <TouchableOpacity
              style={styles.infoCard}
              onPress={handleSleepDataSourcePress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sleep data source, tap to manage sync and permissions"
            >
              <View style={styles.dataSourceRow}>
                <View style={styles.dataSourceLogoWrap}>
                  <Ionicons
                    name={Platform.OS === 'android' ? 'logo-google' : 'logo-apple'}
                    size={28}
                    color={colors.textPrimary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sleep data source</Text>
                  <Text style={styles.value}>{getDataSourceDisplay(hasPermissions)}</Text>
                  <Text style={styles.dataSourceHint}>Tap to sync, permissions, or disconnect</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={colors.textSecondary}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </TouchableOpacity>
          </View>

          <Modal
            visible={sleepDataModalVisible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setSleepDataModalVisible(false)}
          >
            <SafeAreaView style={styles.sleepDataModalSafe} edges={['top', 'bottom']}>
              <View style={styles.sleepDataModalHeader}>
                <Text style={styles.sleepDataModalTitle}>Sleep data source</Text>
                <TouchableOpacity
                  onPress={() => setSleepDataModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.sleepDataModalScroll}
                contentContainerStyle={styles.sleepDataModalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.sleepDataStatusPill}>
                  <View
                    style={[
                      styles.sleepDataStatusDot,
                      hasPermissions ? styles.sleepDataStatusDotOn : styles.sleepDataStatusDotOff,
                    ]}
                  />
                  <Text style={styles.sleepDataStatusText}>
                    {hasPermissions
                      ? `Connected · ${Platform.OS === 'android' ? 'Google Health Connect' : 'Apple Health'}`
                      : 'Not connected'}
                  </Text>
                </View>
                <Text style={styles.sleepDataModalBody}>
                  {Platform.OS === 'android'
                    ? 'Sleep is read through Google Health Connect. Grant access in SleepFactor first, then sync. You can adjust what we may read in Health Connect (app permissions).'
                    : 'Sleep is read from Apple Health. Grant access when prompted, then sync. You can change access anytime in Settings → Privacy & Security → Health → SleepFactor.'}
                </Text>

                {!hasPermissions && isInitialized && (
                  <Button
                    title="Grant sleep access (in app)"
                    onPress={async () => {
                      try {
                        await requestPermissions();
                        await refreshPermissionState();
                      } catch (e) {
                        Alert.alert('Permissions', 'Try again or use Open system settings below.');
                      }
                    }}
                    loading={isLoading}
                    style={styles.sleepDataModalButton}
                  />
                )}

                <Button
                  title="Open system settings (permissions)"
                  onPress={openSystemPermissions}
                  variant="secondary"
                  style={styles.sleepDataModalButton}
                />

                <Button
                  title="Sync all sleep data (last 100 days)"
                  onPress={async () => {
                    if (!user?.id) return;
                    try {
                      await handleSyncData();
                      await refreshPermissionState();
                    } catch (e) {
                      /* handleSyncData already alerts */
                    }
                  }}
                  loading={isLoading}
                  style={styles.sleepDataModalButton}
                />

                <Button
                  title="Disconnect / revoke access"
                  onPress={() => {
                    setSleepDataModalVisible(false);
                    handleDisconnect();
                  }}
                  variant="secondary"
                  style={styles.sleepDataModalButton}
                />

                <TouchableOpacity
                  style={styles.sleepDataModalDone}
                  onPress={() => setSleepDataModalVisible(false)}
                >
                  <Text style={styles.sleepDataModalDoneText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <Text style={[styles.sectionSubTitle, { marginTop: 0 }]}>Display</Text>
            <View style={[styles.infoCard, styles.measurementCard]}>
              <Text style={styles.label}>Units for drinks</Text>
              <View style={styles.measurementContainer}>
                <TouchableOpacity
                  style={[
                    styles.measurementOption,
                    preferences.measurementRegion === 'US' && styles.measurementOptionSelected,
                  ]}
                  onPress={() => savePreferences({ measurementRegion: 'US', measurementSystem: 'imperial' })}
                >
                  <Text
                    style={[
                      styles.measurementText,
                      preferences.measurementRegion === 'US' && styles.measurementTextSelected,
                    ]}
                  >
                    Imperial
                  </Text>
                  <Text
                    style={[
                      styles.measurementSubtext,
                      preferences.measurementRegion === 'US' && styles.measurementSubtextSelected,
                    ]}
                  >
                    fl oz, oz
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.measurementOption,
                    preferences.measurementRegion === 'metric' && styles.measurementOptionSelected,
                  ]}
                  onPress={() => savePreferences({ measurementRegion: 'metric', measurementSystem: 'metric' })}
                >
                  <Text
                    style={[
                      styles.measurementText,
                      preferences.measurementRegion === 'metric' && styles.measurementTextSelected,
                    ]}
                  >
                    Metric
                  </Text>
                  <Text
                    style={[
                      styles.measurementSubtext,
                      preferences.measurementRegion === 'metric' && styles.measurementSubtextSelected,
                    ]}
                  >
                    ml
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.label}>Time format</Text>
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
            <Text style={styles.sectionSubTitle}>Caffeine & alcohol</Text>
            <View style={[styles.infoCard, styles.cardWithTopMargin]}>
              <Text style={styles.label}>Half-life (hours)</Text>
              <Text style={styles.description}>
                Half-life in hours (how long until half the amount leaves your system). Used to show your current level. Caffeine is often 4–6 hours, alcohol about 4–5.
              </Text>
              {caffeineHabitId != null && (
                <View style={styles.halfLifeRow}>
                  <Text style={styles.halfLifeLabel}>Caffeine (hours)</Text>
                  <TextInput
                    style={styles.halfLifeInput}
                    value={caffeineHalfLife}
                    onChangeText={setCaffeineHalfLife}
                    onBlur={() => saveHalfLife(caffeineHabitId, caffeineHalfLife, setCaffeineHalfLife)}
                    keyboardType="decimal-pad"
                    placeholder={String(DEFAULT_CAFFEINE_HALF_LIFE)}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              )}
              {alcoholHabitId != null && (
                <View style={styles.halfLifeRow}>
                  <Text style={styles.halfLifeLabel}>Alcohol (hours)</Text>
                  <TextInput
                    style={styles.halfLifeInput}
                    value={alcoholHalfLife}
                    onChangeText={setAlcoholHalfLife}
                    onBlur={() => saveHalfLife(alcoholHabitId, alcoholHalfLife, setAlcoholHalfLife)}
                    keyboardType="decimal-pad"
                    placeholder={String(DEFAULT_ALCOHOL_HALF_LIFE)}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              )}
              {halfLifeSaving && (
                <Text style={styles.halfLifeSavingText}>Saving...</Text>
              )}
            </View>
            <Text style={styles.sectionSubTitle}>Notifications</Text>
            <View style={[styles.infoCard, styles.notificationsCard, styles.toggleCard]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.label}>Remind me to log my habits</Text>
                  <Text style={styles.description}>
                    Get a daily notification to log your habits for the day
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    habitReminderEnabled && styles.toggleSwitchOn,
                  ]}
                  onPress={async () => {
                    const next = !habitReminderEnabled;
                    setHabitReminderEnabled(next);
                    await habitReminderNotifications.setHabitReminderEnabled(next);
                  }}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      habitReminderEnabled && styles.toggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
              {habitReminderEnabled && (
                <TouchableOpacity
                  style={styles.habitReminderTimeRow}
                  onPress={() => {
                    const [h, m] = (habitReminderTime || '20:00').split(':').map(Number);
                    setReminderPickerHour(isNaN(h) ? 20 : h);
                    setReminderPickerMinute(isNaN(m) ? 0 : m);
                    setShowHabitReminderTimePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.label}>Reminder time</Text>
                  <Text style={styles.value}>
                    {formatReminderTimeForDisplay(habitReminderTime, preferences.timeFormat === '24')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.infoCard, styles.notificationsCard, styles.toggleCard]}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelContainer}>
                  <Text style={styles.label}>Product emails</Text>
                  <Text style={styles.description}>
                    Receive occasional updates and tips by email. You can unsubscribe at any time.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    marketingEmailOptIn && styles.toggleSwitchOn,
                    marketingToggleSaving && styles.toggleSwitchDisabled,
                  ]}
                  disabled={marketingToggleSaving}
                  onPress={handleToggleMarketingEmails}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      marketingEmailOptIn && styles.toggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.sectionSubTitle}>Morning check-in</Text>
            <NavigationCard
              icon="sunny-outline"
              title="Set up how you feel"
              subtitle="Choose what to rate each morning, add custom measures, and set a reminder"
              onPress={() =>
                navigation.dispatch(
                  CommonActions.navigate({
                    name: 'Home',
                    params: { screen: 'SubjectiveMeasures' },
                  })
                )
              }
            />
            <Modal
              visible={showHabitReminderTimePicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowHabitReminderTimePicker(false)}
            >
              <TouchableWithoutFeedback onPress={() => setShowHabitReminderTimePicker(false)}>
                <View style={styles.reminderTimeModalOverlay}>
                  <TouchableWithoutFeedback>
                    <View style={styles.reminderTimeModalContent}>
                      <Text style={styles.reminderTimeModalTitle}>Reminder time</Text>
                      <View style={styles.reminderTimePickerRow}>
                        <View style={styles.reminderPickerGroup}>
                          <Text style={styles.reminderTimeLabel}>Hour</Text>
                          <Picker
                            pickerData={habitReminderHourData}
                            selectedValue={reminderPickerHour.toString()}
                            onValueChange={(val) => setReminderPickerHour(parseInt(val, 10))}
                            textColor={colors.textSecondary}
                            selectTextColor={colors.primary}
                            textSize={20}
                            itemHeight={50}
                            style={styles.reminderWheelPicker}
                          />
                        </View>
                        <View style={styles.reminderPickerGroup}>
                          <Text style={styles.reminderTimeLabel}>Minute</Text>
                          <Picker
                            pickerData={habitReminderMinuteData}
                            selectedValue={reminderPickerMinute.toString()}
                            onValueChange={(val) => setReminderPickerMinute(parseInt(val, 10))}
                            textColor={colors.textSecondary}
                            selectTextColor={colors.primary}
                            textSize={20}
                            itemHeight={50}
                            style={styles.reminderWheelPicker}
                          />
                        </View>
                      </View>
                      <View style={styles.reminderTimeModalFooter}>
                        <TouchableOpacity
                          style={[styles.reminderTimeModalButton, styles.reminderTimeCancelButton]}
                          onPress={() => setShowHabitReminderTimePicker(false)}
                        >
                          <Text style={styles.reminderTimeCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.reminderTimeModalButton, styles.reminderTimeDoneButton]}
                          onPress={() => {
                            const timeStr = `${reminderPickerHour}:${String(reminderPickerMinute).padStart(2, '0')}`;
                            setHabitReminderTime(timeStr);
                            habitReminderNotifications.setHabitReminderTime(timeStr);
                            setShowHabitReminderTimePicker(false);
                          }}
                        >
                          <Text style={styles.reminderTimeDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
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
  headerGlassOuter: {
    marginBottom: spacing.xs,
  },
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerLogo: {
    width: 40,
    height: 40,
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
    paddingBottom: 100, // Space so bottom content clears the navigation footer
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
  accountCardHint: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  sectionSubTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dataSourceLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: BUTTON_BORDER_RADIUS,
    backgroundColor: colors.border + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataSourceHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  sleepDataModalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sleepDataModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  sleepDataModalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sleepDataModalScroll: {
    flex: 1,
  },
  sleepDataModalScrollContent: {
    padding: spacing.regular,
    paddingBottom: spacing.xxl,
  },
  sleepDataStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.cardBackground,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sleepDataStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sleepDataStatusDotOn: {
    backgroundColor: colors.success,
  },
  sleepDataStatusDotOff: {
    backgroundColor: colors.textLight,
  },
  sleepDataStatusText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  sleepDataModalBody: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  sleepDataModalButton: {
    marginBottom: spacing.sm,
  },
  sleepDataModalDone: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingVertical: spacing.md,
  },
  sleepDataModalDoneText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
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
  syncButton: {
    marginTop: spacing.regular,
  },
  disconnectButton: {
    marginTop: spacing.regular,
  },
  logoutButton: {
    marginTop: spacing.xxl + spacing.xl,
    marginBottom: spacing.xl,
  },
  notificationsCard: {
    marginTop: spacing.md,
  },
  cardWithTopMargin: {
    marginTop: spacing.md,
  },
  habitReminderTimeRow: {
    marginTop: spacing.regular,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTimeModalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '90%',
    maxWidth: 350,
    padding: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderTimeModalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  reminderTimePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.md,
  },
  reminderPickerGroup: {
    flex: 1,
    alignItems: 'center',
  },
  reminderTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  reminderWheelPicker: {
    width: '100%',
    height: 200,
    backgroundColor: colors.cardBackground,
  },
  reminderTimeModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderTimeModalButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTimeCancelButton: {
    backgroundColor: colors.border,
  },
  reminderTimeCancelButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  reminderTimeDoneButton: {
    backgroundColor: colors.primary,
  },
  reminderTimeDoneButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  measurementCard: {
    marginBottom: spacing.md,
  },
  measurementContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  halfLifeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  halfLifeLabel: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    flex: 1,
  },
  halfLifeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    minWidth: 64,
    textAlign: 'right',
  },
  halfLifeSavingText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  measurementOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  measurementOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  measurementText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  measurementTextSelected: {
    color: '#FFFFFF',
  },
  measurementSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  measurementSubtextSelected: {
    color: '#FFFFFF',
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
  toggleSwitchDisabled: {
    opacity: 0.65,
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
  openSettingsButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.primary + '20',
    borderRadius: BUTTON_BORDER_RADIUS,
    alignSelf: 'flex-start',
  },
  openSettingsButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
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

