import React, { useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import HabitToggle from './HabitToggle';
import DrugHabitInput from './DrugHabitInput';
import QuickConsumptionInput from './QuickConsumptionInput';

const HabitInput = ({ habit, value, onChange, onHabitChange, unit, selectedDate, userId, onConsumptionAdded, onOpenLogConsumption, yesNoCounts }) => {
  // Stable per-habit callback so parent re-renders don't force consumption modal (and wheel pickers) to re-render and block the custom volume input
  const effectiveOnChange = onHabitChange != null
    ? useCallback((v) => onHabitChange(habit.id, v), [onHabitChange, habit.id])
    : onChange;

  const renderInput = () => {
    switch (habit.type) {
      case 'binary':
        // Convert string/any values to boolean or null (handle DB casing and types)
        let boolValue = null;
        const v = value != null ? String(value).toLowerCase() : '';
        if (v === 'yes' || value === true) {
          boolValue = true;
        } else if (v === 'no' || value === false) {
          boolValue = false;
        }
        
        return (
          <HabitToggle
            value={boolValue}
            onChange={(newBoolValue) => {
              // Convert boolean back to string, or empty string for null
              if (newBoolValue === null) {
                effectiveOnChange('');
              } else {
                effectiveOnChange(newBoolValue ? 'yes' : 'no');
              }
            }}
            yesCount={yesNoCounts?.yes ?? 0}
            noCount={yesNoCounts?.no ?? 0}
          />
        );
      
      case 'numeric':
        return (
          <View style={styles.numericContainer}>
            <TextInput
              style={styles.numericInput}
              value={value ? String(value) : ''}
              onChangeText={(text) => {
                const numValue = text === '' ? '' : parseFloat(text);
                effectiveOnChange(String(numValue || ''));
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textLight}
            />
            {unit && (
              <Text style={styles.unit}>{unit}</Text>
            )}
          </View>
        );
      
      case 'time':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={effectiveOnChange}
            placeholder="Enter time"
            placeholderTextColor={colors.textLight}
          />
        );
      
      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={effectiveOnChange}
            placeholder="Enter text"
            placeholderTextColor={colors.textLight}
            multiline
          />
        );

      case 'drug':
        return (
          <DrugHabitInput
            habit={habit}
            value={value}
            onChange={effectiveOnChange}
            unit={unit}
          />
        );

      case 'quick_consumption':
        return (
          <QuickConsumptionInput
            habit={habit}
            value={value}
            onChange={effectiveOnChange}
            unit={unit}
            selectedDate={selectedDate}
            userId={userId}
            onConsumptionAdded={onConsumptionAdded}
            onOpenLogConsumption={onOpenLogConsumption}
          />
        );

      default:
        return null;
    }
  };

  return <View>{renderInput()}</View>;
};

const styles = StyleSheet.create({
  numericContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numericInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    minWidth: 80,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    minHeight: 44,
  },
  unit: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
});

export default HabitInput;

