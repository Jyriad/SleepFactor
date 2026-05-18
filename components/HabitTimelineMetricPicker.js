import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PressableFeedback from './PressableFeedback';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';

const HabitTimelineMetricPicker = ({
  metrics = [],
  selectedKey,
  onSelect,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = metrics.find((m) => m.key === selectedKey) || metrics[0];

  const handleSelect = (key) => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <>
      <PressableFeedback
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityLabel={`Sleep metric, ${selected?.label || 'not selected'}. Opens list.`}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={styles.triggerLabel}>Sleep metric</Text>
          <Text style={styles.triggerValue} numberOfLines={1}>
            {selected?.label || 'Choose metric'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </PressableFeedback>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sleep metric</Text>
            <PressableFeedback
              onPress={() => setOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </PressableFeedback>
          </View>
          <FlatList
            data={metrics}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.key === selectedKey;
              return (
                <PressableFeedback
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  haptic="selection"
                  onPress={() => handleSelect(item.key)}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {item.label}
                  </Text>
                  {item.unit ? (
                    <Text style={styles.optionUnit}>{item.unit}</Text>
                  ) : null}
                  {isSelected ? (
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                  ) : null}
                </PressableFeedback>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.small,
    marginBottom: spacing.regular,
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerTextWrap: {
    flex: 1,
    marginRight: spacing.small,
  },
  triggerLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  triggerValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.regular,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  listContent: {
    paddingVertical: spacing.small,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.regular,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowSelected: {
    backgroundColor: '#E3EEF8',
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  optionUnit: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginRight: spacing.small,
  },
});

export default HabitTimelineMetricPicker;
