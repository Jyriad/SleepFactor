import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';

const HabitToggle = ({ value, onChange, yesCount = 0, noCount = 0 }) => {
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
        <View style={styles.countBadge}>
          <Text style={[
            styles.countText,
            isNo && styles.countTextActive,
          ]}>{noCount}</Text>
        </View>
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
        <View style={styles.countBadge}>
          <Text style={[
            styles.countText,
            isYes && styles.countTextActive,
          ]}>{yesCount}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
  },
  countText: {
    fontSize: 8,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  countTextActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  activeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  activeText: {
    color: '#FFFFFF',
  },
});

export default HabitToggle;

