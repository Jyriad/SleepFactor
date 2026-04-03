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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../constants';

/**
 * Small "?" control that opens a bottom sheet explaining why insights need a minimum amount of data.
 * @param {'numeric' | 'binary'} variant - binary mentions needing enough yes and no nights.
 */
export default function InsightMinimumDataHelp({ variant = 'numeric', style, iconSize = 18 }) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const binaryExtra =
    variant === 'binary'
      ? '\n\nFor yes/no habits we also need enough nights on each side (at least 10 when you did the habit and 10 when you did not). That way we are not comparing one busy week to a single quiet night.'
      : '';

  const bodyText =
    'Sleep changes from night to night for many reasons besides your habits. With only a few days, a lucky or rough patch can look like a real pattern when it is mostly chance.' +
    '\n\nWe wait until there is enough overlapping habit and sleep data—at least 10 paired nights—before we call something a meaningful link.' +
    binaryExtra +
    '\n\nOnce we cross that bar, you can trust the insight more than a quick snapshot from a handful of logs.';

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={style}
        accessibilityRole="button"
        accessibilityLabel="Why we need more data before showing an insight"
      >
        <Ionicons name="help-circle-outline" size={iconSize} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Why we wait for more data</Text>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
            >
              <Text style={styles.body}>{bodyText}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.doneButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    maxHeight: '78%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  doneButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
