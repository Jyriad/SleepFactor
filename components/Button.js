import React, { useCallback } from 'react';
import { Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../constants/colors';
import { buttonStyles, getButtonPressedStyle } from '../constants/buttonStyles';
import { PRESS_SCALE } from './PressableFeedback';
import { triggerHaptic } from '../utils/haptics';

/**
 * @param {'primary'|'secondary'|'destructive'|'outline'} [variant='primary']
 * @param {'default'|'compact'} [size='default'] — compact tightens padding only; label uses body size with bold weight.
 * @param {'light'|'selection'|'success'|'none'} [haptic='light']
 */
const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  style,
  icon,
  haptic = 'light',
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDestructive = variant === 'destructive';
  const isOutline = variant === 'outline';
  const isCompact = size === 'compact';
  const isDisabled = disabled || loading;

  const spinnerColor =
    isPrimary || isDestructive ? '#FFFFFF' : colors.primary;

  const handlePressIn = useCallback(() => {
    if (!isDisabled && haptic !== 'none') {
      triggerHaptic(haptic);
    }
  }, [isDisabled, haptic]);

  const pressedStyle = getButtonPressedStyle(variant);

  return (
    <Pressable
      style={({ pressed }) => [
        buttonStyles.container,
        isCompact && buttonStyles.containerCompact,
        isPrimary && buttonStyles.primary,
        isSecondary && buttonStyles.secondary,
        isDestructive && buttonStyles.destructive,
        isOutline && buttonStyles.outline,
        isOutline && (isCompact ? buttonStyles.outlineRadiusCompact : buttonStyles.outlineRadiusDefault),
        isDisabled && buttonStyles.disabled,
        icon && buttonStyles.containerWithIcon,
        pressed && !isDisabled && { transform: [{ scale: PRESS_SCALE }] },
        pressed && !isDisabled && pressedStyle,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={
        Platform.OS === 'android'
          ? { color: `${colors.primary}33`, borderless: false }
          : undefined
      }
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              buttonStyles.label,
              isPrimary && buttonStyles.labelPrimary,
              isSecondary && buttonStyles.labelSecondary,
              isDestructive && buttonStyles.labelDestructive,
              isOutline && buttonStyles.labelOutline,
              disabled && buttonStyles.labelDisabled,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

export default Button;
