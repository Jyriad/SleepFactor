import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import subjectiveMeasuresService from '../../services/subjectiveMeasuresService';
import { supabase } from '../../services/supabase';
import { colors } from '../../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingProgress';
import ScoreSlider from '../../components/ScoreSlider';

async function persistSubjectiveOnboardingChoices(
  userId,
  { tiredness, dream, easeSleep, customMeasures }
) {
  // Persist the user's onboarding choices as the source of truth.
  // Built-in measures should only exist when the user opts in.
  await supabase
    .from('users')
    .update({
      track_tiredness: tiredness === true,
      track_dream_vividness: dream === true,
      track_ease_sleep: easeSleep === true,
    })
    .eq('id', userId);

  // Create rows only for opted-in built-ins, then ensure enabled is consistent.
  await subjectiveMeasuresService.ensureBuiltinMeasures(userId);
  const list = await subjectiveMeasuresService.listSubjectiveMeasures(userId);
  const t = list.find((m) => m.slug === 'tiredness');
  const d = list.find((m) => m.slug === 'dream_vividness');
  const e = list.find((m) => m.slug === 'ease_sleep');
  const toggles = [];
  if (t) toggles.push(subjectiveMeasuresService.setMeasureEnabled(userId, t.id, tiredness === true));
  if (d) toggles.push(subjectiveMeasuresService.setMeasureEnabled(userId, d.id, dream === true));
  if (e) toggles.push(subjectiveMeasuresService.setMeasureEnabled(userId, e.id, easeSleep === true));
  await Promise.all(toggles);
  await Promise.all(
    (customMeasures || []).map((m) =>
      subjectiveMeasuresService.addCustomMeasure(userId, {
        label: m.label,
        hint: m.hint,
        leftLabel: m.leftLabel,
        rightLabel: m.rightLabel,
      })
    )
  );
}

export default function OnboardingSubjectiveMeasuresScreen({ navigation }) {
  const { user } = useAuth();
  const [tiredness, setTiredness] = useState(false);
  const [dream, setDream] = useState(false);
  const [easeSleep, setEaseSleep] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHint, setCustomHint] = useState('');
  const [customLeftLabel, setCustomLeftLabel] = useState('Low');
  const [customRightLabel, setCustomRightLabel] = useState('High');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMeasures, setCustomMeasures] = useState([]);
  const proceedStartedRef = useRef(false);

  const proceed = () => {
    if (!user?.id || proceedStartedRef.current) return;
    proceedStartedRef.current = true;

    const payload = {
      tiredness,
      dream,
      easeSleep,
      customMeasures: [...customMeasures],
    };
    const userId = user.id;

    navigation.navigate('OnboardingWearableMetrics');

    void persistSubjectiveOnboardingChoices(userId, payload).catch((err) => {
      console.warn('[OnboardingSubjectiveMeasures] background save failed', err);
    });
  };

  const renderAddIcon = (selected, onPress) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.addIconBtn, selected && styles.addIconBtnSelected]}
      accessibilityRole="button"
      accessibilityLabel={selected ? 'Added measure' : 'Add measure'}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
        size={28}
        color={selected ? colors.success : colors.primary}
      />
    </TouchableOpacity>
  );

  return (
    <OnboardingStepLayout
      step={10}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title={
        <Text style={styles.onboardingHeroTitle}>
          Also track how you{' '}
          <Text style={styles.onboardingHeroTitleUnderline}>feel</Text>
          {' '}
          each morning
        </Text>
      }
      contentPaddingBottom={72 + spacing.onboardingFooterExtraBottom}
      onNext={proceed}
      onBack={() => navigation.goBack()}
      onSkip={proceed}
      nextLabel="Next"
      showSkip
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Submit scores each day about how you felt about your sleep last night.
        </Text>
        <View style={[styles.row, tiredness && styles.rowSelected]}>
          <View>
            <Text style={styles.optionName}>Refreshed feeling</Text>
            <Text style={styles.optionSub}>How rested you felt on waking</Text>
          </View>
          {renderAddIcon(tiredness, () => setTiredness((v) => !v))}
        </View>
        <View style={[styles.row, dream && styles.rowSelected]}>
          <View>
            <Text style={styles.optionName}>Dream strength</Text>
            <Text style={styles.optionSub}>How vivid or strong dreams felt</Text>
          </View>
          {renderAddIcon(dream, () => setDream((v) => !v))}
        </View>
        <View style={[styles.row, easeSleep && styles.rowSelected]}>
          <View>
            <Text style={styles.optionName}>Easily fell asleep</Text>
            <Text style={styles.optionSub}>How easily did you fall asleep?</Text>
          </View>
          {renderAddIcon(easeSleep, () => setEaseSleep((v) => !v))}
        </View>
        {customMeasures.map((measure, idx) => (
          <View key={`${measure.label}-${idx}`} style={styles.row}>
            <View>
              <Text style={styles.optionName}>{measure.label}</Text>
              <Text style={styles.optionSub}>
                {measure.hint || `${measure.leftLabel || 'Low'} to ${measure.rightLabel || 'High'}`}
              </Text>
            </View>
            {renderAddIcon(
              true,
              () => setCustomMeasures((prev) => prev.filter((_, removeIdx) => removeIdx !== idx))
            )}
          </View>
        ))}
        <TouchableOpacity
          style={styles.addCustomMeasureButton}
          onPress={() => {
            setCustomName('');
            setCustomHint('');
            setCustomLeftLabel('Low');
            setCustomRightLabel('High');
            setShowCustomModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addCustomMeasureText}>Add a custom measure</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCustomModal(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.dragHandle} />
                <Text style={styles.modalTitle}>Custom measure</Text>
                <Text style={styles.modalHint}>
                  Name what you want to rate each morning (for example Stress or Mood).
                </Text>
                <TextInput
                  style={styles.input}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Measure name"
                  placeholderTextColor={colors.textLight}
                  maxLength={120}
                />
                <TextInput
                  style={styles.input}
                  value={customHint}
                  onChangeText={setCustomHint}
                  placeholder="Description shown below title (optional)"
                  placeholderTextColor={colors.textLight}
                  maxLength={300}
                  multiline
                />
                <View style={styles.axisLabelsRow}>
                  <View style={styles.axisInputGroup}>
                    <Text style={styles.axisLabelTitle}>From</Text>
                    <TextInput
                      style={[styles.input, styles.axisInput]}
                      value={customLeftLabel}
                      onChangeText={setCustomLeftLabel}
                      placeholder="e.g. Calm"
                      placeholderTextColor={colors.textLight}
                      maxLength={80}
                    />
                  </View>
                  <View style={styles.axisInputGroup}>
                    <Text style={styles.axisLabelTitle}>To</Text>
                    <TextInput
                      style={[styles.input, styles.axisInput]}
                      value={customRightLabel}
                      onChangeText={setCustomRightLabel}
                      placeholder="e.g. Stressed"
                      placeholderTextColor={colors.textLight}
                      maxLength={80}
                    />
                  </View>
                </View>
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>Preview</Text>
                  <ScoreSlider
                    label={customName.trim() || 'Your custom measure'}
                    hint={customHint.trim() || 'Description will appear here'}
                    value={null}
                    onValueChange={() => {}}
                    leftLabel={customLeftLabel.trim() || 'Low'}
                    rightLabel={customRightLabel.trim() || 'High'}
                    containerStyle={styles.previewSlider}
                  />
                </View>
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowCustomModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.doneButton]}
                    onPress={() => {
                      const label = customName.trim();
                      if (!label) return;
                      const hint = customHint.trim();
                      const leftLabel = customLeftLabel.trim() || 'Low';
                      const rightLabel = customRightLabel.trim() || 'High';
                      if (!customMeasures.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
                        setCustomMeasures((prev) => [...prev, { label, hint, leftLabel, rightLabel }]);
                      }
                      setCustomName('');
                      setCustomHint('');
                      setCustomLeftLabel('Low');
                      setCustomRightLabel('High');
                      setShowCustomModal(false);
                    }}
                  >
                    <Text style={styles.doneButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  onboardingHeroTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  onboardingHeroTitleUnderline: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  scroll: {
    paddingBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.success + '10',
  },
  optionName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  optionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  addCustomMeasureButton: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addCustomMeasureText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBtnSelected: {
    backgroundColor: colors.success + '1F',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    backgroundColor: colors.cardBackground,
    marginBottom: spacing.sm,
  },
  axisLabelsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  axisInput: {
    marginBottom: 0,
  },
  axisInputGroup: {
    flex: 1,
  },
  axisLabelTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.background,
    marginTop: spacing.xs,
  },
  previewLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  previewSlider: {
    marginBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textLight + '88',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalHint: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  doneButtonText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});
