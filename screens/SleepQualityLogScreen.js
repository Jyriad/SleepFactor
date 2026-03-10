import React, { useState, useEffect, useCallback } from 'react';
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
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import homeCacheService from '../services/homeCacheService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import ScoreSlider from '../components/ScoreSlider';
import { formatDateForDB, getToday } from '../utils/dateHelpers';

function getDateString(param) {
  if (!param) return null;
  if (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  const d = param instanceof Date ? param : new Date(param);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateForDB(d);
}

const SleepQualityLogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const dateStr = getDateString(route.params?.date);
  const [trackTiredness, setTrackTiredness] = useState(false);
  const [trackDreamVividness, setTrackDreamVividness] = useState(false);
  const [tirednessScore, setTirednessScore] = useState(null);
  const [dreamVividnessScore, setDreamVividnessScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedScores, setHasSavedScores] = useState(false);
  const [subjectiveDirty, setSubjectiveDirty] = useState(false);
  const [subjectiveSavedAt, setSubjectiveSavedAt] = useState(null);

  const updateHomeLastNightCache = useCallback(async (nextPartialScores) => {
    if (!user?.id) return;
    try {
      const todayStr = formatDateForDB(new Date());
      const cached = await homeCacheService.getPersistedDashboardPayload(user.id, todayStr);
      if (!cached || cached.error) {
        console.warn('[SleepQualityLog] No home cache to update for', todayStr);
        return;
      }
      const currentLastNight = cached.last_night_subjective && typeof cached.last_night_subjective === 'object'
        ? cached.last_night_subjective
        : {};
      const merged = { ...currentLastNight, ...nextPartialScores };
      const hasAny = merged.tiredness_score != null || merged.dream_vividness_score != null;
      console.warn('[SleepQualityLog] Updating home subjective cache', {
        todayStr,
        nextPartialScores,
        merged,
        hasAny,
      });
      await homeCacheService.setPersistedDashboardPayload(user.id, todayStr, {
        ...cached,
        last_night_subjective: hasAny ? merged : null,
      });
    } catch (_) {
      // Best effort cache sync for immediate Home screen consistency.
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !dateStr) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [userRow, sleepRow] = await Promise.all([
        supabase.from('users').select('track_tiredness, track_dream_vividness').eq('id', user.id).single(),
        sleepDataService.getSleepDataForDate(dateStr),
      ]);
      if (cancelled) return;
      const u = userRow?.data;
      setTrackTiredness(u?.track_tiredness === true);
      setTrackDreamVividness(u?.track_dream_vividness === true);
      if (sleepRow) {
        if (sleepRow.tiredness_score != null) setTirednessScore(sleepRow.tiredness_score);
        if (sleepRow.dream_vividness_score != null) setDreamVividnessScore(sleepRow.dream_vividness_score);
        setHasSavedScores(sleepRow.tiredness_score != null || sleepRow.dream_vividness_score != null);
      }
      setSubjectiveDirty(false);
      setSubjectiveSavedAt(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, dateStr]);

  const handleSave = async () => {
    if (!user?.id || !dateStr) return;
    const scores = {};
    if (trackTiredness && tirednessScore != null) scores.tiredness_score = tirednessScore;
    if (trackDreamVividness && dreamVividnessScore != null) scores.dream_vividness_score = dreamVividnessScore;
    if (Object.keys(scores).length === 0) {
      return;
    }
    setSaving(true);
    try {
      await sleepDataService.updateSubjectiveScores(user.id, dateStr, scores);
      console.warn('[SleepQualityLog] Saved subjective scores', { dateStr, scores });
      await updateHomeLastNightCache(scores);
      homeCacheService.setSubjectiveJustSavedForToday();
      homeCacheService.setPendingSubjectiveScoresForToday(scores);
      setHasSavedScores(true);
      setSubjectiveDirty(false);
      setSubjectiveSavedAt(new Date());
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const handleTirednessChange = useCallback((score) => {
    setTirednessScore(score);
    setSubjectiveDirty(true);
    setSubjectiveSavedAt(null);
  }, []);

  const handleDreamVividnessChange = useCallback((score) => {
    setDreamVividnessScore(score);
    setSubjectiveDirty(true);
    setSubjectiveSavedAt(null);
  }, []);

  const handleRemoveScores = () => {
    Alert.alert(
      'Remove scores',
      'Remove refreshed feeling and dream strength for last night?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id || !dateStr) return;
            setSaving(true);
            try {
              await sleepDataService.updateSubjectiveScores(user.id, dateStr, { tiredness_score: null, dream_vividness_score: null });
              console.warn('[SleepQualityLog] Removed subjective scores', { dateStr });
              await updateHomeLastNightCache({ tiredness_score: null, dream_vividness_score: null });
              homeCacheService.setSubjectiveJustSavedForToday();
              homeCacheService.setPendingSubjectiveScoresForToday(null);
              setTirednessScore(null);
              setDreamVividnessScore(null);
              setHasSavedScores(false);
              setSubjectiveDirty(false);
              setSubjectiveSavedAt(null);
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

  const isLastNight = dateStr === getToday();

  if (!dateStr) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How did you sleep?</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.bodyText}>Invalid date.</Text>
        </View>
      </View>
    );
  }

  if (!isLastNight) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How did you sleep?</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.bodyText}>You can only log refreshed feeling and dream strength for last night&apos;s sleep.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How did you sleep?</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const showAny = trackTiredness || trackDreamVividness;
  const hasAnySelection = (trackTiredness && tirednessScore != null) || (trackDreamVividness && dreamVividnessScore != null);
  const canSave = hasAnySelection && !saving;
  const subjectiveStatusText = !hasAnySelection
    ? 'Choose at least one score to save.'
    : saving
      ? 'Saving your changes...'
      : subjectiveDirty
        ? 'Unsaved changes'
        : (subjectiveSavedAt ? 'Saved' : ' ');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How did you sleep?</Text>
        <Text style={styles.headerSubtitle}>Last night</Text>
      </View>
      {!showAny ? (
        <View style={styles.centered}>
          <Text style={styles.bodyText}>Turn on &quot;Track refreshed feeling&quot; or &quot;Track dream strength&quot; in Profile to log how you felt.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {trackTiredness && (
            <ScoreSlider
              label="Refreshed feeling"
              hint="How refreshed did you feel when you first woke up?"
              value={tirednessScore}
              onValueChange={handleTirednessChange}
              leftLabel="Not refreshed"
              rightLabel="Very refreshed"
            />
          )}
          {trackTiredness && (
            <Text style={styles.metricHelperText}>Why we ask: this helps us find which habits are linked to feeling more refreshed in the morning.</Text>
          )}
          {trackDreamVividness && (
            <ScoreSlider
              label="Dream strength"
              hint="How strong or vivid did your dreams feel?"
              value={dreamVividnessScore}
              onValueChange={handleDreamVividnessChange}
              leftLabel="No memory"
              rightLabel="Very strong"
            />
          )}
          {trackDreamVividness && (
            <Text style={styles.metricHelperText}>Why we ask: this helps us spot patterns between your routines and dream intensity.</Text>
          )}
          <View style={styles.actions}>
            <View style={styles.subjectiveStatusRow}>
              <Ionicons
                name={subjectiveSavedAt && !subjectiveDirty && !saving ? 'checkmark-circle' : 'information-circle-outline'}
                size={14}
                color={subjectiveSavedAt && !subjectiveDirty && !saving ? colors.success : colors.textSecondary}
              />
              <Text style={[
                styles.subjectiveStatusText,
                subjectiveSavedAt && !subjectiveDirty && !saving && styles.subjectiveStatusTextSaved,
              ]}>
                {subjectiveStatusText}
              </Text>
            </View>
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
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.regular,
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
    padding: spacing.regular,
    paddingBottom: spacing.xxl,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.regular,
  },
  subjectiveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 18,
  },
  subjectiveStatusText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  subjectiveStatusTextSaved: {
    color: colors.success,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    marginTop: spacing.sm,
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
  metricHelperText: {
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default SleepQualityLogScreen;
