import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow';
import ScatterPlot from '../../components/ScatterChart';
import DrugLevelLineChart from '../../components/DrugLevelLineChart';

const HABIT_TYPES = [
  {
    id: 'consumption',
    title: 'Alcohol / Caffeine consumption',
    subtitle: 'Track drinks or servings to compare dose and timing',
    icon: 'wine-outline',
  },
  {
    id: 'binary',
    title: 'Binary habits',
    subtitle: 'Simple yes/no habits like exercise or eyemask',
    icon: 'checkbox-outline',
  },
  {
    id: 'numeric',
    title: 'Numerical habits',
    subtitle: 'Counted habits like steps or cups',
    icon: 'stats-chart-outline',
  },
  {
    id: 'time',
    title: 'Time habits',
    subtitle: 'Clock-based habits like last meal time',
    icon: 'time-outline',
  },
];

function BinaryPreview() {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>Binary: E.g Exercise (Yes/No)</Text>
      <View style={styles.binaryInsightPreview}>
        <Text style={styles.binaryHeadline}>You get moderately higher deep sleep when you do Exercise</Text>
        <View style={styles.binaryBars}>
          <View style={styles.binaryBarRow}>
            <Text style={styles.binaryBarLabel}>Did habit (22 days)</Text>
            <View style={styles.binaryBarTrack}>
              <View style={[styles.binaryBarFill, { width: '100%' }]} />
            </View>
            <Text style={styles.binaryBarValue}>78.4 min</Text>
          </View>
          <View style={styles.binaryBarRow}>
            <Text style={styles.binaryBarLabel}>Didn&apos;t do habit (20 days)</Text>
            <View style={styles.binaryBarTrack}>
              <View style={[styles.binaryBarFillAlt, { width: '90%' }]} />
            </View>
            <Text style={styles.binaryBarValue}>70.8 min</Text>
          </View>
        </View>
      </View>
      <Text style={styles.binaryFootnote}>
        We take the mean average of your sleep metric for each night where you did the habit during the day and
        compare it to when you didn&apos;t do the habit.
      </Text>
    </View>
  );
}

/** Minutes before bed vs REM: loose positive relationship (lots of night-to-night noise) */
const TIME_HABIT_SCATTER = [
  { x: 25, y: 46 },
  { x: 30, y: 36 },
  { x: 32, y: 36 },
  { x: 34, y: 78 },
  { x: 35, y: 54 },
  { x: 41, y: 52 },
  { x: 46, y: 55 },
  { x: 59, y: 49 },
  { x: 62, y: 58 },
  { x: 71, y: 37 },
  { x: 78, y: 56 },
  { x: 92, y: 43 },
  { x: 94, y: 50 },
  { x: 95, y: 59 },
  { x: 97, y: 46 },
  { x: 98, y: 61 },
  { x: 99, y: 40 },
  { x: 104, y: 43 },
  { x: 105, y: 49 },
  { x: 112, y: 56 },
  { x: 115, y: 42 },
  { x: 117, y: 52 },
  { x: 122, y: 47 },
  { x: 123, y: 50 },
  { x: 131, y: 42 },
  { x: 137, y: 60 },
  { x: 139, y: 56 },
  { x: 148, y: 45 },
  { x: 150, y: 55 },
  { x: 165, y: 42 },
  { x: 170, y: 48 },
  { x: 171, y: 49 },
  { x: 172, y: 50 },
  { x: 173, y: 48 },
  { x: 175, y: 65 },
  { x: 182, y: 44 },
  { x: 183, y: 53 },
  { x: 186, y: 64 },
  { x: 188, y: 68 },
  { x: 192, y: 58 },
  { x: 198, y: 48 },
  { x: 204, y: 69 },
  { x: 211, y: 54 },
  { x: 215, y: 55 },
  { x: 224, y: 64 },
  { x: 227, y: 76 },
  { x: 228, y: 63 },
  { x: 230, y: 73 },
  { x: 232, y: 57 },
  { x: 234, y: 67 },
  { x: 235, y: 65 },
  { x: 240, y: 59 },
];

function TimePreview() {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>Time habits</Text>
      <Text style={styles.previewBody}>
        We plot how many minutes before your normal bedtime you did the habit
      </Text>
      <ScatterPlot
        data={TIME_HABIT_SCATTER}
        width={280}
        height={180}
        xLabel="Last meal time"
        yLabel="REM sleep"
        showTrendLine
        fixedDomainX={{ min: 20, max: 250 }}
        fixedDomainY={{ min: 35, max: 95 }}
        color={colors.primary}
        pointColor={colors.primary}
        trendLineColor={colors.success}
      />
    </View>
  );
}

export default function OnboardingHabitTypesScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);

  const numericalData = useMemo(
    () => [
      { x: 0.5, y: 86 }, { x: 0.8, y: 72 }, { x: 1.1, y: 78 }, { x: 1.4, y: 63 },
      { x: 1.7, y: 81 }, { x: 2.0, y: 58 }, { x: 2.3, y: 74 }, { x: 2.6, y: 67 },
      { x: 2.9, y: 79 }, { x: 3.2, y: 55 }, { x: 3.5, y: 71 }, { x: 3.8, y: 62 },
      { x: 4.1, y: 76 }, { x: 4.4, y: 50 }, { x: 4.7, y: 69 }, { x: 5.0, y: 60 },
      { x: 5.3, y: 73 }, { x: 5.6, y: 48 }, { x: 5.9, y: 66 }, { x: 6.2, y: 57 },
      { x: 6.5, y: 70 }, { x: 6.8, y: 45 }, { x: 7.1, y: 63 }, { x: 7.4, y: 54 },
      { x: 2.2, y: 84 }, { x: 4.9, y: 79 }, { x: 6.0, y: 72 }, { x: 7.3, y: 49 },
      { x: 3.1, y: 83 }, { x: 5.5, y: 75 }, { x: 6.9, y: 68 }, { x: 7.6, y: 58 },
    ],
    [],
  );

  const alcoholCurve = useMemo(
    () => [
      { time: '2026-01-01T00:00:00Z', level: 220 },
      { time: '2026-01-01T02:00:00Z', level: 167 },
      { time: '2026-01-01T04:00:00Z', level: 128 },
      { time: '2026-01-01T06:00:00Z', level: 97 },
      { time: '2026-01-01T08:00:00Z', level: 74 },
      { time: '2026-01-01T10:00:00Z', level: 57 },
      { time: '2026-01-01T12:00:00Z', level: 43 },
      { time: '2026-01-01T14:00:00Z', level: 33 },
      { time: '2026-01-01T16:00:00Z', level: 25 },
      { time: '2026-01-01T18:00:00Z', level: 19 },
      { time: '2026-01-01T20:00:00Z', level: 15 },
      { time: '2026-01-01T22:00:00Z', level: 11 },
      { time: '2026-01-02T00:00:00Z', level: 8 },
    ],
    [],
  );

  const consumptionScatterData = useMemo(
    () => [
      { x: 0.8, y: 58 }, { x: 1.2, y: 34 }, { x: 1.5, y: 49 }, { x: 1.9, y: 27 },
      { x: 2.1, y: 54 }, { x: 2.4, y: 23 }, { x: 2.8, y: 45 }, { x: 3.0, y: 31 },
      { x: 3.2, y: 52 }, { x: 3.6, y: 20 }, { x: 3.9, y: 42 }, { x: 4.1, y: 28 },
      { x: 4.5, y: 48 }, { x: 4.8, y: 18 }, { x: 5.0, y: 39 }, { x: 5.3, y: 26 },
      { x: 5.7, y: 44 }, { x: 6.0, y: 16 }, { x: 6.4, y: 35 }, { x: 6.8, y: 22 },
      { x: 7.2, y: 40 }, { x: 7.7, y: 19 }, { x: 8.1, y: 14 }, { x: 8.6, y: 29 },
      { x: 2.7, y: 62 }, { x: 4.4, y: 57 }, { x: 6.9, y: 50 }, { x: 7.9, y: 43 },
      { x: 3.4, y: 55 }, { x: 5.6, y: 47 }, { x: 6.2, y: 41 }, { x: 8.3, y: 24 },
    ],
    [],
  );

  const renderPreview = () => {
    if (selectedType === 'binary') return <BinaryPreview />;
    if (selectedType === 'time') return <TimePreview />;
    if (selectedType === 'numeric') {
      return (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Numerical: Allows you to submit a number</Text>
          <ScatterPlot
            data={numericalData}
            width={280}
            height={170}
            xLabel="Screen time"
            yLabel="Sleep score"
            showTrendLine
            color={colors.primary}
            pointColor={colors.primary}
          />
        </View>
      );
    }
    return (
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Caffeine and Alchol</Text>
        <Text style={styles.previewBody}>
          Caffeine and alcohol break down in your system over a half life, quickly at first, then slower. The
          time and amount you consume impact how much is left in your system by bedtime.
        </Text>
        <DrugLevelLineChart dataPoints={alcoholCurve} unit="mg" width={280} height={140} />
        <View style={styles.previewSpacer} />
        <ScatterPlot
          data={consumptionScatterData}
          width={280}
          height={160}
          xLabel="Caffeine/Alcohol left by bedtime"
          yLabel="Deep sleep"
          showTrendLine
          color={colors.primary}
          pointColor={colors.primary}
        />
        <Text style={styles.previewFootnote}>
          We calculate how much is left in your system and plot it against information about your sleep that night.
        </Text>
      </View>
    );
  };

  return (
    <>
      <OnboardingStepLayout
        step={9}
        totalSteps={ONBOARDING_STEP_TOTAL}
        title="How different habits are analysed"
        onNext={() => navigation.navigate('OnboardingSubjectiveMeasures')}
        onBack={() => navigation.goBack()}
        nextLabel="Continue"
        showSkip={false}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {HABIT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={styles.typeCard}
              activeOpacity={0.8}
              onPress={() => setSelectedType(type.id)}
            >
              <View style={styles.typeIcon}>
                <Ionicons name={type.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.typeTextWrap}>
                <Text style={styles.typeTitle}>{type.title}</Text>
                <Text style={styles.typeSub}>{type.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </OnboardingStepLayout>

      <Modal
        visible={!!selectedType}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedType(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedType(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.dragHandle} />
                {renderPreview()}
                <TouchableOpacity style={styles.doneBtn} onPress={() => setSelectedType(null)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.lg,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '1A',
  },
  typeTextWrap: {
    flex: 1,
  },
  typeTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  typeSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textLight + '88',
    marginBottom: spacing.sm,
  },
  previewCard: {
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  previewBody: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.small,
    marginBottom: spacing.sm,
  },
  previewSpacer: {
    height: spacing.sm,
  },
  binaryInsightPreview: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  binaryHeadline: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.small,
  },
  binaryBars: {
    gap: spacing.sm,
  },
  binaryBarRow: {
    gap: spacing.xs,
  },
  binaryBarLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  binaryBarTrack: {
    height: 22,
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  binaryBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  binaryBarFillAlt: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.secondary,
    borderRadius: 6,
  },
  binaryBarValue: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  binaryFootnote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.xs,
    marginTop: spacing.sm,
  },
  previewFootnote: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.xs,
    marginTop: spacing.sm,
  },
  doneBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.body,
  },
});
