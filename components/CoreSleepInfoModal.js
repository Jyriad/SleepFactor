import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const CORE_SLEEP_EXPLANATION = `Core sleep is the first part of your night that you almost always get. The app uses your own sleep history to work out a length (the 20th percentile), so about 80% of your nights are at least that long.

On the home screen, the bar above your sleep shows exactly that period: the first chunk of the night we treat as "core" sleep. That way you can see how much of each night falls inside that window.

In Insights, turning "Core Sleep" on means we only look at that same period when linking habits to sleep. That focuses the analysis on the sleep you usually get, rather than including late-night or early-morning bits that vary a lot.`;

const CoreSleepInfoModal = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalContainer}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>What is core sleep?</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.body}>{CORE_SLEEP_EXPLANATION}</Text>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});

export default CoreSleepInfoModal;
