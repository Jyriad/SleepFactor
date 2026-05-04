import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const under = { textDecorationLine: 'underline' };

function ExplainerBodyText({ style, accountLegacy }) {
  return (
    <Text style={[styles.modalBody, style]}>
      In Insights, we compare how you felt to <Text style={under}>that night&apos;s sleep</Text> and the
      habits you logged in <Text style={under}>the day before</Text>
      {accountLegacy
        ? '. Custom measures will show in this list after your account finishes updating.'
        : ', so you can see patterns over time.'}
    </Text>
  );
}

/**
 * "?" control that opens a short modal explaining how subjective ratings are used in Insights
 * (progressive disclosure). Underlines: that night’s sleep, the day before.
 */
export function SubjectiveInsightsInfoButton({ style, hitSlop, color, iconSize = 22, accountLegacy }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={() => setOpen(true)}
        hitSlop={hitSlop || { top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="How Insights uses your morning check-in"
      >
        <Ionicons name="help-circle-outline" size={iconSize} color={color || colors.textSecondary} />
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>How this is used in Insights</Text>
                  <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close">
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ExplainerBodyText accountLegacy={accountLegacy} />
                <TouchableOpacity style={styles.modalDone} onPress={() => setOpen(false)} activeOpacity={0.8}>
                  <Text style={styles.modalDoneText}>OK</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  modalBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalDone: {
    marginTop: spacing.lg,
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalDoneText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
