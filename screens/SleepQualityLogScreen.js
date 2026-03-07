import React, { useState, useEffect } from 'react';
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
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import ScoreSlider from '../components/ScoreSlider';
import { getYesterday } from '../utils/dateHelpers';

function getDateString(param) {
  if (!param) return null;
  const d = param instanceof Date ? param : new Date(param);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
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
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      await sleepDataService.updateSubjectiveScores(user.id, dateStr, scores);
      navigation.goBack();
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
    Alert.alert(
      'Remove scores',
      'Remove tiredness and dream vividness for last night?',
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
              navigation.goBack();
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

  const isLastNight = dateStr === getYesterday();

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
          <Text style={styles.bodyText}>You can only log tiredness and dream vividness for last night&apos;s sleep.</Text>
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
  const canSave = (trackTiredness ? tirednessScore != null : true) && (trackDreamVividness ? dreamVividnessScore != null : true);

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
          <Text style={styles.bodyText}>Turn on &quot;Track tiredness&quot; or &quot;Track dream vividness&quot; in Profile to log how you felt.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {trackTiredness && (
            <ScoreSlider
              label="Tiredness"
              hint="1 = very tired, 10 = not tired"
              value={tirednessScore}
              onValueChange={setTirednessScore}
              leftLabel="Very tired"
              rightLabel="Not tired"
            />
          )}
          {trackDreamVividness && (
            <ScoreSlider
              label="Dream vividness"
              hint="1 = no memory, 10 = very vivid"
              value={dreamVividnessScore}
              onValueChange={setDreamVividnessScore}
              leftLabel="No memory"
              rightLabel="Very vivid"
            />
          )}
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={saving}>
              <Text style={styles.skipButtonText}>Skip</Text>
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
});

export default SleepQualityLogScreen;
