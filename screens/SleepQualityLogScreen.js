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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import subjectiveMeasuresService from '../services/subjectiveMeasuresService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import ScoreSlider from '../components/ScoreSlider';
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
  const { user } = useAuth();
  const dateStr = getDateString(route.params?.date);
  const [measures, setMeasures] = useState([]);
  const [scoresByMeasureId, setScoresByMeasureId] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedScores, setHasSavedScores] = useState(false);

  const enabledMeasures = useMemo(
    () => (measures || []).filter((m) => m.enabled === true),
    [measures]
  );

  const setScoreForMeasure = useCallback((measureId, value) => {
    setScoresByMeasureId((prev) => ({ ...prev, [measureId]: value }));
  }, []);

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
  }, [user?.id, dateStr]);

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
    try {
      await sleepDataService.updateSubjectiveScores(user.id, dateStr, payload);
      homeCacheService.clearLastAppliedDashboardPayload(user.id, dateStr);
      await homeCacheService.clearPersistedDashboardPayload(user.id, dateStr);
      if (dateStr === getToday()) {
        homeCacheService.setSubjectiveJustSavedForToday();
        homeCacheService.setPendingSubjectiveScoresForToday(
          buildPendingPayload(scoresByMeasureId, enabledMeasures)
        );
      }
      setHasSavedScores(true);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
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
            try {
              const customByMeasureId = {};
              for (const m of enabledMeasures) {
                if (!m.is_builtin) {
                  customByMeasureId[m.id] = null;
                }
              }
              await sleepDataService.updateSubjectiveScores(user.id, dateStr, {
                tiredness_score: null,
                dream_vividness_score: null,
                ...(Object.keys(customByMeasureId).length > 0 ? { customByMeasureId } : {}),
              });
              homeCacheService.clearLastAppliedDashboardPayload(user.id, dateStr);
              await homeCacheService.clearPersistedDashboardPayload(user.id, dateStr);
              if (dateStr === getToday()) {
                homeCacheService.setSubjectiveJustSavedForToday();
                homeCacheService.setPendingSubjectiveScoresForToday(null);
              }
              setScoresByMeasureId({});
              setHasSavedScores(false);
            } catch (e) {
              Alert.alert('Error', 'Could not remove. Please try again.');
            } finally {
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
            <Text style={styles.headerTitle}>How did you sleep?</Text>
          </View>
        </View>
        <View style={styles.centered}>
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
            <Text style={styles.headerTitle}>How did you sleep?</Text>
            <Text style={styles.headerSubtitle}>
              {dateStr === getToday() ? 'This morning (today)' : `Morning of ${formatDateTitle(dateStr)}`}
            </Text>
          </View>
        </View>
        <View style={styles.centered}>
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
          <Text style={styles.headerTitle}>How did you sleep?</Text>
          <Text style={styles.headerSubtitle}>
            {dateStr === getToday() ? 'This morning (today)' : `Morning of ${screenDateLabel}`}
          </Text>
        </View>
      </View>
      {!showAny ? (
        <View style={styles.centered}>
          <Text style={styles.bodyText}>Turn on morning check-in measures in Profile to log how you felt.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {enabledMeasures.map((m) => (
            <ScoreSlider
              key={m.id}
              label={m.label}
              hint={m.hint || ''}
              value={scoresByMeasureId[m.id] ?? null}
              onValueChange={(score) => setScoreForMeasure(m.id, score)}
              leftLabel={m.left_label || 'Low'}
              rightLabel={m.right_label || 'High'}
            />
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
    marginBottom: spacing.xs,
  },
  headerInner: {
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.sm,
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
    paddingBottom: spacing.xl,
  },
  actions: {
    marginTop: 0,
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
