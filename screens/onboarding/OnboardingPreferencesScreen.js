import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';
import OnboardingProgressHeader from '../../components/OnboardingProgressHeader';
import { getOnboardingProgress } from '../../constants/onboardingProgress';

function regionToSystem(region) {
  if (region === 'US') return 'imperial';
  return 'metric';
}

export default function OnboardingPreferencesScreen({ navigation }) {
  const { preferences, savePreferences } = useUserPreferences();
  const [timeFormat, setTimeFormat] = useState(preferences?.timeFormat || '12');
  const [measurementRegion, setMeasurementRegion] = useState(
    preferences?.measurementRegion === 'US'
      ? 'US'
      : preferences?.measurementRegion === 'UK'
        ? 'UK'
        : 'metric'
  );
  const [saving, setSaving] = useState(false);

  const { currentStep, totalSteps, progress } = getOnboardingProgress('OnboardingPreferences');

  const onContinue = async () => {
    setSaving(true);
    try {
      await savePreferences({
        timeFormat,
        measurementRegion,
        measurementSystem: regionToSystem(measurementRegion),
      });
      navigation.navigate('OnboardingSleepGoal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.progressSlot}>
            <OnboardingProgressHeader currentStep={currentStep} totalSteps={totalSteps} progress={progress} />
          </View>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>A couple of quick preferences</Text>
        <Text style={styles.body}>
          Set your preferred time format and units now. You can change these later in Profile while we finish syncing
          your data in the background.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Time format</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.option, timeFormat === '12' && styles.optionSelected]}
              onPress={() => setTimeFormat('12')}
            >
              <Text style={[styles.optionTitle, timeFormat === '12' && styles.optionTitleSelected]}>12-hour</Text>
              <Text style={[styles.optionSub, timeFormat === '12' && styles.optionSubSelected]}>8:30 PM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.option, timeFormat === '24' && styles.optionSelected]}
              onPress={() => setTimeFormat('24')}
            >
              <Text style={[styles.optionTitle, timeFormat === '24' && styles.optionTitleSelected]}>24-hour</Text>
              <Text style={[styles.optionSub, timeFormat === '24' && styles.optionSubSelected]}>20:30</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Drink units</Text>
          <View style={styles.regionColumn}>
            <TouchableOpacity
              style={[styles.regionOption, measurementRegion === 'US' && styles.optionSelected]}
              onPress={() => setMeasurementRegion('US')}
            >
              <Text style={[styles.optionTitle, measurementRegion === 'US' && styles.optionTitleSelected]}>
                US / Imperial
              </Text>
              <Text style={[styles.optionSub, measurementRegion === 'US' && styles.optionSubSelected]}>
                fl oz cups and glasses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regionOption, measurementRegion === 'UK' && styles.optionSelected]}
              onPress={() => setMeasurementRegion('UK')}
            >
              <Text style={[styles.optionTitle, measurementRegion === 'UK' && styles.optionTitleSelected]}>
                UK
              </Text>
              <Text style={[styles.optionSub, measurementRegion === 'UK' && styles.optionSubSelected]}>
                ml, pints and UK glass sizes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regionOption, measurementRegion === 'metric' && styles.optionSelected]}
              onPress={() => setMeasurementRegion('metric')}
            >
              <Text style={[styles.optionTitle, measurementRegion === 'metric' && styles.optionTitleSelected]}>
                Metric / International
              </Text>
              <Text style={[styles.optionSub, measurementRegion === 'metric' && styles.optionSubSelected]}>
                ml cans and standard glasses
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" onPress={onContinue} loading={saving} disabled={saving} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  scroll: {
    paddingBottom: 120 + spacing.onboardingFooterExtraBottom,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  progressSlot: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  regionColumn: {
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  regionOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  optionTitleSelected: {
    color: colors.white,
  },
  optionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  optionSubSelected: {
    color: colors.white,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md + spacing.onboardingFooterExtraBottom,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
