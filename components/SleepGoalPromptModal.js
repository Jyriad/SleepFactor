import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../constants';
import Button from './Button';
import SleepGoalPicker from './SleepGoalPicker';
import { DEFAULT_SLEEP_GOAL_ID } from '../constants/sleepGoals';

export default function SleepGoalPromptModal({ visible, initialGoalId, onSave, onDismiss }) {
  const insets = useSafeAreaInsets();
  const [goalId, setGoalId] = useState(initialGoalId || DEFAULT_SLEEP_GOAL_ID);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.sheet, { marginTop: insets.top + spacing.lg }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>What matters most for your sleep?</Text>
            <Text style={styles.body}>
              We'll prioritise insights that match your goal. You can change this anytime in Profile.
            </Text>
            <SleepGoalPicker selectedId={goalId} onSelect={setGoalId} />
            <Button
              title="Save preference"
              onPress={() => onSave(goalId)}
              style={styles.cta}
            />
            <TouchableOpacity onPress={onDismiss} style={styles.skip}>
              <Text style={styles.skipText}>Not now</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    marginHorizontal: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.regular,
    maxHeight: '80%',
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.body,
  },
  cta: {
    marginTop: spacing.md,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
  },
});
