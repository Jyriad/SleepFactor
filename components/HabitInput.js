import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import HabitToggle from './HabitToggle';

const HabitInput = ({ habit, value, onChange, unit }) => {
  const renderInput = () => {
    switch (habit.type) {
      case 'binary':
        return (
          <HabitToggle
            value={value === 'yes' || value === true}
            onChange={(boolValue) => onChange(boolValue ? 'yes' : 'no')}
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
                onChange(String(numValue || ''));
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
            onChangeText={onChange}
            placeholder="Enter time"
            placeholderTextColor={colors.textLight}
          />
        );
      
      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={onChange}
            placeholder="Enter text"
            placeholderTextColor={colors.textLight}
            multiline
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

