import React, { useCallback } from 'react';
import { Pressable, Platform } from 'react-native';
import { colors } from '../constants/colors';
import { triggerHaptic } from '../utils/haptics';

export const PRESS_SCALE = 0.97;

const defaultRipple = { color: `${colors.primary}33`, borderless: false };

/**
 * Pressable with light haptic, scale-down while pressed, and Android ripple.
 * Use for custom buttons; shared `Button` uses the same feedback patterns.
 *
 * @param {'light'|'selection'|'success'|'none'} [haptic='light']
 */
const PressableFeedback = ({
  children,
  onPress,
  onPressIn,
  onLongPress,
  disabled = false,
  style,
  pressedStyle,
  haptic = 'light',
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  android_ripple = defaultRipple,
  ...rest
}) => {
  const handlePressIn = useCallback(
    (event) => {
      if (!disabled && haptic !== 'none') {
        triggerHaptic(haptic);
      }
      onPressIn?.(event);
    },
    [disabled, haptic, onPressIn]
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      android_ripple={Platform.OS === 'android' ? android_ripple : undefined}
      style={({ pressed }) => {
        const base = typeof style === 'function' ? style({ pressed }) : style;
        if (!pressed || disabled) {
          return base;
        }
        return [
          base,
          { transform: [{ scale: PRESS_SCALE }] },
          pressedStyle,
        ];
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

export default PressableFeedback;
