import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import subjectiveMeasuresService from '../services/subjectiveMeasuresService';
import offlineWriteQueueService from '../services/offlineWriteQueueService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import ScoreSlider from '../components/ScoreSlider';
import { SubjectiveInsightsInfoButton } from '../components/SubjectiveInsightsInfoModal';
import { formatDateForDB, formatDateTitle, getToday } from '../utils/dateHelpers';

function getDateString(param) {
  if (!param) return null;
  if (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  const d = param instanceof Date ? param : new Date(param);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateForDB(d);
}

function buildPendingPayload(scoresByMeasureId, measures) {
  const out = {
    tiredness_score: null,
    dream_vividness_score: null,
    extra: [],
  };
  const customByMeasureId = {};
  for (const m of measures) {
    const v = scoresByMeasureId[m.id];
    if (m.slug === 'tiredness') {
      out.tiredness_score = v != null ? v : null;
    } else if (m.slug === 'dream_vividness') {
      out.dream_vividness_score = v != null ? v : null;
    } else if (v != null) {
      customByMeasureId[m.id] = v;
      out.extra.push({ measure_id: m.id, label: m.label, score: v });
    }
  }
  if (Object.keys(customByMeasureId).length > 0) {
    out.customByMeasureId = customByMeasureId;
  }
  return out;
}

const SleepQualityLogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  /** Keeps the last line of content above the tab bar + home indicator. */
  const bottomContentPad = tabBarHeight + insets.bottom + spacing.lg;
  const { user } = useAuth();
  const dateStr = getDateString(route.params?.date);
  const [measures, setMeasures] = useState([]);
  const [scoresByMeasureId, setScoresByMeasureId] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedScores, setHasSavedScores] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const enabledMeasures = useMemo(
    () => (measures || []).filter((m) => m.enabled === true),
    [measures]
  );

  const setScoreForMeasure = useCallback((measureId, value) => {
    setScoresByMeasureId((prev) => ({ ...prev, [measureId]: value }));
  }, []);

  // Refresh measure configuration when returning from "Set up what you log".
  useFocusEffect(
    useCallback(() => {
      setRefreshTick((t) => t + 1);
    }, [])
  );

  useEffect(() => {
    if (!user?.id || !dateStr) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      let cachedSub = null;
      try {
        const cached = await homeCacheService.getPersistedDashboardPayload(user.id, dateStr);
        if (cached?.last_night_subjective && typeof cached.last_night_subjective === 'object') {
          cachedSub = cached.last_night_subjective;
        }
      } catch (_e) {}

      const fetchWithRetry = async () => {
        await subjectiveMeasuresService.ensureBuiltinMeasures(user.id);
        const list = await subjectiveMeasuresService.listSubjectiveMeasures(user.id);
        const sleepRow = await sleepDataService.getSleepDataForDate(dateStr);
        const customMap = await subjectiveMeasuresService.getCustomScoresForDate(user.id, dateStr);
        return { list, sleepRow, customMap };
      };

      let list = [];
      let sleepRow = null;
      let customMap = {};
      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 350;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await fetchWithRetry();
          list = result.list;
          sleepRow = result.sleepRow;
          customMap = result.customMap;
          break;
        } catch (_e) {
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }

      if (cancelled) return;

      try {
        setMeasures(list || []);

        const nextScores = {};
        const lm = list || [];
        if (cachedSub) {
          for (const m of lm) {
            if (m.slug === 'tiredness' && cachedSub.tiredness_score != null) {
              nextScores[m.id] = cachedSub.tiredness_score;
            }
            if (m.slug === 'dream_vividness' && cachedSub.dream_vividness_score != null) {
              nextScores[m.id] = cachedSub.dream_vividness_score;
            }
          }
          if (Array.isArray(cachedSub.extra)) {
            cachedSub.extra.forEach((row) => {
              if (row.measure_id != null && row.score != null) nextScores[row.measure_id] = row.score;
            });
          }
        }
        if (sleepRow) {
          const t = sleepRow.tiredness_score;
          const d = sleepRow.dream_vividness_score;
          for (const m of lm) {
            if (m.slug === 'tiredness' && t != null) nextScores[m.id] = t;
            if (m.slug === 'dream_vividness' && d != null) nextScores[m.id] = d;
          }
        }
        Object.keys(customMap).forEach((mid) => {
          if (customMap[mid] != null) nextScores[mid] = customMap[mid];
        });

        setScoresByMeasureId(nextScores);
        const hasAny =
          Object.keys(nextScores).length > 0 &&
          Object.values(nextScores).some((v) => v != null);
        if (hasAny) setHasSavedScores(true);
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, dateStr, refreshTick]);

  const handleSave = async () => {
    if (!user?.id || !dateStr) return;
    const payload = {};
    const customByMeasureId = {};
    for (const m of enabledMeasures) {
      const v = scoresByMeasureId[m.id];
      if (m.slug === 'tiredness') payload.tiredness_score = v ?? null;
      else if (m.slug === 'dream_vividness') payload.dream_vividness_score = v ?? null;
      else if (v != null) customByMeasureId[m.id] = v;
    }
    if (Object.keys(customByMeasureId).length > 0) payload.customByMeasureId = customByMeasureId;

    const hasAny =
      payload.tiredness_score != null ||
      payload.dream_vividness_score != null ||
      Object.keys(customByMeasureId).length > 0;
    if (!hasAny) return;

    setSaving(true);
    let queuedForSync = false;
    try {
      await sleepDataService.updateSubjectiveScores(user.id, dateStr, payload);
    } catch (e) {
      await offlineWriteQueueService.enqueue(
        offlineWriteQueueService.ACTION_TYPES.SUBJECTIVE_UPSERT,
        { userId: user.id, dateStr, payload },
        { dedupeKey: `subjective:${user.id}:${dateStr}` }
      );
      queuedForSync = true;
    } finally {
      homeCacheService.clearLastAppliedDashboardPayload(user.id, dateStr);
      await homeCacheService.clearPersistedDashboardPayload(user.id, dateStr);
      if (dateStr === getToday()) {
        homeCacheService.setSubjectiveJustSavedForToday();
        homeCacheService.setPendingSubjectiveScoresForToday(
          buildPendingPayload(scoresByMeasureId, enabledMeasures)
        );
      }
      setHasSavedScores(true);
      if (queuedForSync) {
        Alert.alert('Saved offline', 'Your check-in was saved and will sync automatically once you are back online.');
      }
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const handleRemoveScores = () => {
    const dayLabel = formatDateTitle(dateStr);
    Alert.alert(
      'Remove scores',
      `Remove your morning check-in scores for ${dayLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id || !dateStr) return;
            setSaving(true);
            let queuedForSync = false;
            const customByMeasureId = {};
            for (const m of enabledMeasures) {
              // ease_sleep uses subjective_score_entries like custom measures but is_displayed as built-in
              if (!m.is_builtin || m.slug === 'ease_sleep') {
                customByMeasureId[m.id] = null;
              }
            }
            const clearPayload = {
              tiredness_score: null,
              dream_vividness_score: null,
              ...(Object.keys(customByMeasureId).length > 0 ? { customByMeasureId } : {}),
            };
            try {
              await sleepDataService.updateSubjectiveScores(user.id, dateStr, clearPayload);
            } catch (e) {
              await offlineWriteQueueService.enqueue(
                offlineWriteQueueService.ACTION_TYPES.SUBJECTIVE_UPSERT,
                { userId: user.id, dateStr, payload: clearPayload },
                { dedupeKey: `subjective:${user.id}:${dateStr}` }
              );
              queuedForSync = true;
            } finally {
              homeCacheService.clearLastAppliedDashboardPayload(user.id, dateStr);
              await homeCacheService.clearPersistedDashboardPayload(user.id, dateStr);
              if (dateStr === getToday()) {
                homeCacheService.setSubjectiveJustSavedForToday();
                homeCacheService.setPendingSubjectiveScoresForToday(null);
              }
              setScoresByMeasureId({});
              setHasSavedScores(false);
              if (queuedForSync) {
                Alert.alert('Saved offline', 'Removal was saved and will sync automatically once you are back online.');
              }
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (!dateStr) {
    return (
      <View style={styles.container}>
        <View style={styles.headerWrap}>
          <View style={[styles.headerInner, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>How do you feel?</Text>
          </View>
        </View>
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <Text style={styles.bodyText}>Invalid date.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerWrap}>
          <View style={[styles.headerInner, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerTitle}>How do you feel?</Text>
                <Text style={styles.headerSubtitle}>{formatDateTitle(dateStr)}</Text>
              </View>
              <SubjectiveInsightsInfoButton accountLegacy={false} color={colors.white} iconSize={20} />
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.setupLogRow}
          onPress={() => navigation.navigate('SubjectiveMeasures')}
          activeOpacity={0.7}
        >
          <Text style={styles.setupLogText}>Set up what you log</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} style={styles.setupLogChevron} />
        </TouchableOpacity>
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const showAny = enabledMeasures.length > 0;
  const hasAnySelection = enabledMeasures.some((m) => scoresByMeasureId[m.id] != null);
  const canSave = hasAnySelection && !saving;
  const screenDateLabel = formatDateTitle(dateStr);

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <View style={[styles.headerInner, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>How do you feel?</Text>
              <Text style={styles.headerSubtitle}>{screenDateLabel}</Text>
            </View>
            <SubjectiveInsightsInfoButton accountLegacy={false} color={colors.white} iconSize={20} />
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.setupLogRow}
        onPress={() => navigation.navigate('SubjectiveMeasures')}
        activeOpacity={0.7}
      >
        <Text style={styles.setupLogText}>Set up what you log</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} style={styles.setupLogChevron} />
      </TouchableOpacity>
      {!showAny ? (
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <Text style={styles.bodyText}>
            Turn on at least one morning check-in measure to log how you felt.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomContentPad }]}
          keyboardShouldPersistTaps="handled"
        >
          {enabledMeasures.map((m) => (
            <View key={m.id} style={styles.measureCard}>
              <ScoreSlider
                label={m.label}
                hint={m.hint || ''}
                value={scoresByMeasureId[m.id] ?? null}
                onValueChange={(score) => setScoreForMeasure(m.id, score)}
                leftLabel={m.left_label || 'Low'}
                rightLabel={m.right_label || 'High'}
                containerStyle={styles.measureCardSlider}
              />
            </View>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={saving}>
              <Text style={styles.skipButtonText}>Back</Text>
            </TouchableOpacity>
            <Button
              title={saving ? 'Saving…' : 'Save'}
              onPress={handleSave}
              disabled={saving || !canSave}
              style={styles.saveButton}
            />
            {hasSavedScores && (
              <TouchableOpacity onPress={handleRemoveScores} style={styles.removeScoresButton} disabled={saving}>
                <Text style={styles.removeScoresButtonText}>Remove scores</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWrap: {
    backgroundColor: colors.primaryDark,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  setupLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.background,
  },
  setupLogText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  setupLogChevron: {
    marginLeft: 2,
  },
  headerInner: {
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.white,
    opacity: 0.9,
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
  },
  measureCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  measureCardSlider: {
    marginBottom: 0,
  },
  actions: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
  },
  skipButtonText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  saveButton: {
    minWidth: 160,
    alignSelf: 'center',
  },
  removeScoresButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
    marginTop: spacing.xs,
  },
  removeScoresButtonText: {
    fontSize: typography.sizes.body,
    color: colors.error,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.regular,
  },
  bodyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default SleepQualityLogScreen;
