import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const HabitToggle = ({ value, onChange }) => {
  // value can be true, false, or null/undefined (not selected)
  const isYes = value === true;
  const isNo = value === false;
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isNo && styles.activeButton,
        ]}
        onPress={() => onChange(isNo ? null : false)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          isNo && styles.activeText,
        ]}>
          No
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.button,
          isYes && styles.activeButton,
        ]}
        onPress={() => onChange(isYes ? null : true)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          isYes && styles.activeText,
        ]}>
          Yes
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  activeText: {
    color: '#FFFFFF',
  },
});

export default HabitToggle;

