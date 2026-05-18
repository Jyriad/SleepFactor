/**
 * Single source of truth for button chrome and labels.
 * Change primary / outline / compact appearance here to update every Button instance.
 */
import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

/** One radius for `Button`, custom Touchables that behave like CTAs, and matching inputs/segment wrappers. */
export const BUTTON_BORDER_RADIUS = 12;

/** Inner pill radius for segmented controls with ~2px gutter (matches prior 10/8 pairing). */
export const BUTTON_SEGMENT_INNER_RADIUS = BUTTON_BORDER_RADIUS - 4;

export const buttonStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: BUTTON_BORDER_RADIUS,
    minHeight: 44,
    paddingVertical: spacing.regular,
    paddingHorizontal: spacing.xl,
  },
  containerWithIcon: {
    gap: spacing.sm,
  },
  containerCompact: {
    minHeight: 34,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.regular,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.secondary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryPressed: {
    backgroundColor: `${colors.primary}18`,
  },
  destructive: {
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.error,
  },
  destructivePressed: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlinePressed: {
    backgroundColor: colors.accent,
  },
  outlineRadiusDefault: {
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  outlineRadiusCompact: {
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.body,
    fontWeight: typography.weights.bold,
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  labelSecondary: {
    color: colors.primary,
  },
  labelDestructive: {
    color: '#FFFFFF',
  },
  labelOutline: {
    color: colors.primary,
  },
  labelDisabled: {
    opacity: 0.6,
  },
});

/** Pressed background for each Button variant. */
export function getButtonPressedStyle(variant) {
  switch (variant) {
    case 'primary':
      return buttonStyles.primaryPressed;
    case 'secondary':
      return buttonStyles.secondaryPressed;
    case 'destructive':
      return buttonStyles.destructivePressed;
    case 'outline':
      return buttonStyles.outlinePressed;
    default:
      return buttonStyles.primaryPressed;
  }
}
