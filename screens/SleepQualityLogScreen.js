import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
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
import PressableFeedback from '../components/PressableFeedback';
import ScoreSlider from '../components/ScoreSlider';
import { SubjectiveInsightsInfoButton } from '../components/SubjectiveInsightsInfoModal';
import { formatDateForDB, formatDateTitle, getToday } from '../utils/dateHelpers';
import AppSheetLayout from '../components/AppSheetLayout';

function getDateString(param) {
  if (!param) return null;
  if (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  const d = param instanceof Date ? param : new Date(param);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateForDB(d);
}

/** Resolve score after legacy placeholders are swapped for real measure rows. */
function pickScoreForMeasure(measure, previousMeasures, scoresByMeasureId) {
  let v = scoresByMeasureId[measure.id];
  if (v != null) return v;
  const peer = previousMeasures.find((p) => p.slug === measure.slug && p.id !== measure.id);
  if (peer) return scoresByMeasureId[peer.id];
  return undefined;
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

/** Map a subjective snapshot (home cache / last-saved) onto current measure rows by slug + id. */
function applySubjectiveSnapshotToScores(snapshot, measuresList) {
  const nextScores = {};
  if (!snapshot || !measuresList?.length) return nextScores;
  for (const m of measuresList) {
    if (m.slug === 'tiredness' && snapshot.tiredness_score != null) {
      nextScores[m.id] = snapshot.tiredness_score;
    }
    if (m.slug === 'dream_vividness' && snapshot.dream_vividness_score != null) {
      nextScores[m.id] = snapshot.dream_vividness_score;
    }
  }
  if (Array.isArray(snapshot.extra)) {
    snapshot.extra.forEach((row) => {
      if (row.measure_id == null || row.score == null) return;
      const measure =
        measuresList.find((m) => m.id === row.measure_id) ||
        (row.label ? measuresList.find((m) => m.label === row.label) : null);
      if (measure) nextScores[measure.id] = row.score;
    });
  }
  return nextScores;
}

/** Memoized row so changing one slider does not rebuild every native Slider (fixes tap lag between rows). */
const SleepQualityMeasureSliderRow = React.memo(function SleepQualityMeasureSliderRow({
  measureId,
  label,
  hint,
  leftLabel,
  rightLabel,
  value,
  onCommitted,
}) {
  const handleChange = useCallback(
    (score) => {
      onCommitted(measureId, score);
    },
    [measureId, onCommitted]
  );
  return (
    <View style={styles.measureCard}>
      <ScoreSlider
        label={label}
        hint={hint}
        value={value}
        onValueChange={handleChange}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        containerStyle={styles.measureCardSlider}
      />
    </View>
  );
});

const SleepQualityLogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  /** Sheet presentation: pad above home indicator only (no tab bar in the sheet). */
  const bottomContentPad = Math.max(insets.bottom, spacing.md) + spacing.lg;
  const { user } = useAuth();
  const dateStr = getDateString(route.params?.date);
  const [measures, setMeasures] = useState([]);
  const [scoresByMeasureId, setScoresByMeasureId] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedScores, setHasSavedScores] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const enabledMeasures = useMemo(() => {
    return (measures || []).filter((m) => m.enabled !== false);
  }, [measures]);

  const setScoreForMeasure = useCallback((measureId, value) => {
    setScoresByMeasureId((prev) => ({ ...prev, [measureId]: value }));
  }, []);

  const returnToHome = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('HomeMain');
  }, [navigation]);

  const openMeasureSetup = useCallback(() => {
    navigation.navigate('SubjectiveMeasures');
  }, [navigation]);

  const sheetHeaderRight = (
    <View style={styles.sheetHeaderActions}>
      <TouchableOpacity
        onPress={openMeasureSetup}
        style={styles.sheetHeaderMoreButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Set up what you log"
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <SubjectiveInsightsInfoButton accountLegacy={false} color={colors.primary} iconSize={20} />
    </View>
  );

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
      let cachedSubFromPersistedDashboard = false;
      try {
        const cached = await homeCacheService.getPersistedDashboardPayload(user.id, dateStr);
        if (cached?.last_night_subjective && typeof cached.last_night_subjective === 'object') {
          cachedSub = cached.last_night_subjective;
          cachedSubFromPersistedDashboard = true;
        }
      } catch (_e) {}

      if (!cachedSub && dateStr === getToday()) {
        cachedSub = homeCacheService.peekLastSavedSubjectiveScoresForToday();
      }

      /** Never block sliders on sleep/custom fetches — they can throw (auth timing, RPC, offline). */
      let list = [];
      const MEASURES_RETRIES = 2;
      const RETRY_DELAY_MS = 350;
      for (let attempt = 1; attempt <= MEASURES_RETRIES; attempt++) {
        try {
          const fetched =
            await subjectiveMeasuresService.listSubjectiveMeasuresWithLegacyFallback(user.id);
          list = Array.isArray(fetched) ? fetched : [];
          break;
        } catch (e) {
          console.warn('[SleepQualityLogScreen] subjective measures load failed:', e?.message);
          if (attempt < MEASURES_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }

      let sleepRow = null;
      try {
        sleepRow = await sleepDataService.getSleepDataForDate(dateStr, user.id);
      } catch (e) {
        console.warn('[SleepQualityLogScreen] sleep row load failed:', e?.message);
      }

      let customMap = {};
      try {
        customMap = await subjectiveMeasuresService.getCustomScoresForDate(user.id, dateStr);
      } catch (e) {
        console.warn('[SleepQualityLogScreen] custom subjective scores load failed:', e?.message);
      }

      if (cancelled) return;

      try {
        setMeasures(list || []);

        const nextScores = applySubjectiveSnapshotToScores(cachedSub, list || []);
        const lm = list || [];
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

        setScoresByMeasureId((prev) => {
          const merged = { ...nextScores };
          for (const m of lm) {
            if (merged[m.id] == null) {
              const fromPrev = pickScoreForMeasure(m, lm, prev);
              if (fromPrev != null) merged[m.id] = fromPrev;
            }
          }
          return merged;
        });
        const hasAny =
          Object.keys(nextScores).length > 0 &&
          Object.values(nextScores).some((v) => v != null);
        if (hasAny) setHasSavedScores(true);
        if (cachedSubFromPersistedDashboard && hasAny) {
          homeCacheService.clearLastSavedSubjectiveScoresForToday();
        }
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
    const hadLegacy = enabledMeasures.some((m) => m._legacy);
    let measuresForSave = enabledMeasures;
    if (hadLegacy) {
      const resolved = await subjectiveMeasuresService.resolveLegacyMeasuresToDbRows(user.id, enabledMeasures);
      measuresForSave = resolved.filter((m) => m.enabled !== false);
    }

    const payload = {};
    const customByMeasureId = {};
    for (const m of measuresForSave) {
      const v = pickScoreForMeasure(m, enabledMeasures, scoresByMeasureId);
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

    const pendingScores = { ...scoresByMeasureId };
    for (const m of measuresForSave) {
      const picked = pickScoreForMeasure(m, enabledMeasures, scoresByMeasureId);
      if (picked != null) pendingScores[m.id] = picked;
    }
    for (const om of enabledMeasures) {
      if (om._legacy) delete pendingScores[om.id];
    }

    setSaving(true);
    let queuedForSync = false;
    try {
      await sleepDataService.updateSubjectiveScores(user.id, dateStr, payload);
      if (hadLegacy) {
        const refreshed = await subjectiveMeasuresService.listSubjectiveMeasuresWithLegacyFallback(user.id);
        setMeasures(refreshed);
        setScoresByMeasureId((prev) => {
          const next = { ...prev };
          for (const oldM of enabledMeasures) {
            if (!oldM._legacy) continue;
            const nu = refreshed.find((r) => r.slug === oldM.slug && !r._legacy);
            if (!nu || oldM.id === nu.id) continue;
            if (next[nu.id] == null && next[oldM.id] != null) next[nu.id] = next[oldM.id];
            delete next[oldM.id];
          }
          return next;
        });
      }
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
        const savedSnapshot = buildPendingPayload(pendingScores, measuresForSave);
        homeCacheService.setPendingSubjectiveScoresForToday(savedSnapshot);
        homeCacheService.setLastSavedSubjectiveScoresForToday(savedSnapshot);
      }
      setHasSavedScores(true);
      if (queuedForSync) {
        Alert.alert('Saved offline', 'Your check-in was saved and will sync automatically once you are back online.');
      }
      setSaving(false);
      returnToHome();
    }
  };

  const handleSkip = () => {
    returnToHome();
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
            let measuresForClear = enabledMeasures;
            if (enabledMeasures.some((m) => m._legacy)) {
              measuresForClear = await subjectiveMeasuresService.resolveLegacyMeasuresToDbRows(
                user.id,
                enabledMeasures
              );
              measuresForClear = measuresForClear.filter((m) => m.enabled !== false);
            }
            const customByMeasureId = {};
            for (const m of measuresForClear) {
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
                homeCacheService.clearLastSavedSubjectiveScoresForToday();
              }
              setScoresByMeasureId({});
              setHasSavedScores(false);
              if (queuedForSync) {
                Alert.alert('Saved offline', 'Removal was saved and will sync automatically once you are back online.');
              }
              setSaving(false);
              returnToHome();
            }
          },
        },
      ]
    );
  };

  if (!dateStr) {
    return (
      <AppSheetLayout
        title="How do you feel?"
        subtitle="Invalid date"
        onDismiss={returnToHome}
        scroll={false}
        nativePresentation
      >
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <Text style={styles.bodyText}>Invalid date.</Text>
        </View>
      </AppSheetLayout>
    );
  }

  if (loading) {
    return (
      <AppSheetLayout
        title="How do you feel?"
        subtitle={formatDateTitle(dateStr)}
        onDismiss={returnToHome}
        headerRight={sheetHeaderRight}
        scroll={false}
        nativePresentation
      >
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppSheetLayout>
    );
  }

  const showAny = enabledMeasures.length > 0;
  const hasAnySelection = enabledMeasures.some((m) => scoresByMeasureId[m.id] != null);
  const canSave = hasAnySelection && !saving;
  const screenDateLabel = formatDateTitle(dateStr);

  return (
    <AppSheetLayout
      title="How do you feel?"
      subtitle={screenDateLabel}
      onDismiss={returnToHome}
      headerRight={sheetHeaderRight}
      scroll={showAny}
      nativePresentation
      contentContainerStyle={showAny ? styles.sheetScrollContent : undefined}
    >
      {!showAny ? (
        <View style={[styles.centered, { paddingBottom: bottomContentPad }]}>
          <Text style={styles.bodyText}>
            Turn on at least one morning check-in measure to log how you felt.
          </Text>
        </View>
      ) : (
        <>
          {enabledMeasures.map((m) => (
            <SleepQualityMeasureSliderRow
              key={m.id}
              measureId={m.id}
              label={m.label}
              hint={m.hint || ''}
              leftLabel={m.left_label || 'Low'}
              rightLabel={m.right_label || 'High'}
              value={scoresByMeasureId[m.id] ?? null}
              onCommitted={setScoreForMeasure}
            />
          ))}
          <View style={styles.actions}>
            <PressableFeedback onPress={handleSkip} style={styles.skipButton} disabled={saving}>
              <Text style={styles.skipButtonText}>Back</Text>
            </PressableFeedback>
            <Button
              title={saving ? 'Saving…' : 'Save'}
              onPress={handleSave}
              disabled={saving || !canSave}
              style={styles.saveButton}
            />
            {hasSavedScores && (
              <PressableFeedback onPress={handleRemoveScores} style={styles.removeScoresButton} disabled={saving}>
                <Text style={styles.removeScoresButtonText}>Remove scores</Text>
              </PressableFeedback>
            )}
          </View>
        </>
      )}
    </AppSheetLayout>
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
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sheetHeaderMoreButton: {
    padding: 2,
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
  sheetScrollContent: {
    paddingTop: spacing.xs,
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
