import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const Button = ({ title, onPress, variant = 'primary', disabled = false, loading = false, style, icon }) => {
  const isPrimary = variant === 'primary';
  const isDestructive = variant === 'destructive';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        isDestructive && styles.destructiveButton,
        disabled && styles.disabledButton,
        icon && styles.buttonWithIcon,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDestructive ? '#FFFFFF' : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.buttonText,
            isPrimary && styles.primaryText,
            variant === 'secondary' && styles.secondaryText,
            isDestructive && styles.destructiveText,
            disabled && styles.disabledText,
            icon && styles.buttonTextWithIcon,
          ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonWithIcon: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  destructiveButton: {
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.error,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  buttonTextWithIcon: {
    marginLeft: 0,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: colors.primary,
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  disabledText: {
    opacity: 0.6,
  },
});

export default Button;

