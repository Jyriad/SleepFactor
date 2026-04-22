import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import subjectiveMeasuresService from '../../services/subjectiveMeasuresService';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import OnboardingStepLayout from './OnboardingStepLayout';
import { ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingProgress';

const OPTION_TIRED = { id: 'tired', name: 'Refreshed feeling', sub: 'How rested you felt on waking' };
const OPTION_DREAM = { id: 'dream', name: 'Dream strength', sub: 'How vivid or strong dreams felt' };

export default function OnboardingSubjectiveMeasuresScreen({ navigation }) {
  const { user } = useAuth();
  const [tiredness, setTiredness] = useState(true);
  const [dream, setDream] = useState(true);
  const [customName, setCustomName] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMeasures, setCustomMeasures] = useState([]);
  const [saving, setSaving] = useState(false);
  const tiredScale = useRef(new Animated.Value(1)).current;
  const dreamScale = useRef(new Animated.Value(1)).current;

  const toggle = (key) => {
    const scale = key === 'tired' ? tiredScale : dreamScale;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.02,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    if (key === 'tired') setTiredness((v) => !v);
    else setDream((v) => !v);
  };

  const proceed = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await subjectiveMeasuresService.ensureBuiltinMeasures(user.id);
      const list = await subjectiveMeasuresService.listSubjectiveMeasures(user.id);
      const t = list.find((m) => m.slug === 'tiredness');
      const d = list.find((m) => m.slug === 'dream_vividness');
      if (t) await subjectiveMeasuresService.setMeasureEnabled(user.id, t.id, tiredness);
      if (d) await subjectiveMeasuresService.setMeasureEnabled(user.id, d.id, dream);
      for (const label of customMeasures) {
        await subjectiveMeasuresService.addCustomMeasure(user.id, { label });
      }
      navigation.navigate('OnboardingWearableMetrics');
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (item, selected, scale) => (
    <Animated.View key={item.id} style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.optionCard, selected && styles.optionCardSelected]}
        onPress={() => toggle(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="sunny-outline"
          size={36}
          color={selected ? colors.primary : colors.textLight}
        />
        <Text style={[styles.optionName, selected && styles.optionNameSelected]}>{item.name}</Text>
        <Text style={styles.optionSub}>{item.sub}</Text>
        {selected ? (
          <View style={styles.checkWrap}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <OnboardingStepLayout
      step={10}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title="Morning check-in"
      onNext={proceed}
      onBack={() => navigation.goBack()}
      onSkip={proceed}
      nextLabel="Next"
      nextLoading={saving}
      showSkip
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Pick 1–2 quick ratings for a 5-second morning check-in to see how your feelings align with your watch
          data.
        </Text>
        <View style={styles.grid}>
          {renderCard(OPTION_TIRED, tiredness, tiredScale)}
          {renderCard(OPTION_DREAM, dream, dreamScale)}
        </View>
        <TouchableOpacity
          style={styles.addCustomMeasureButton}
          onPress={() => {
            setCustomName('');
            setShowCustomModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addCustomMeasureText}>Add a custom measure</Text>
        </TouchableOpacity>

        {customMeasures.length > 0 ? (
          <View style={styles.customSection}>
            <Text style={styles.customSectionTitle}>Custom measures</Text>
            <View style={styles.grid}>
              {customMeasures.map((label) => (
                <View key={label} style={styles.customMeasureCard}>
                  <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
                  <Text style={styles.customMeasureName}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCustomModal(false)}>
          <View style={styles.modalOverlay}>
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
                      if (!customMeasures.includes(label)) {
                        setCustomMeasures((prev) => [...prev, label]);
                      }
                      setCustomName('');
                      setShowCustomModal(false);
                    }}
                  >
                    <Text style={styles.doneButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.lg,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionCard: {
    flex: 1,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '26',
  },
  optionName: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  optionNameSelected: {
    color: colors.primary,
  },
  optionSub: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  checkWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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
  customSection: {
    marginTop: spacing.md,
  },
  customSectionTitle: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  customMeasureCard: {
    flex: 1,
    minHeight: 120,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMeasureName: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
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
    borderRadius: 10,
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
