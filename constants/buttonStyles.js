/**
 * Single source of truth for button chrome and labels.
 * Change primary / outline / compact appearance here to update every Button instance.
 */
import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { FONT_FAMILY } from './fonts';
import { typography } from './typography';
import { spacing } from './spacing';

/** One radius for `Button`, custom Touchables that behave like CTAs, and matching inputs/segment wrappers. */
export const BUTTON_BORDER_RADIUS = 12;

/** Inner pill radius for segmented controls with ~2px gutter (matches prior 10/8 pairing). */
export const BUTTON_SEGMENT_INNER_RADIUS = BUTTON_BORDER_RADIUS - 4;

/** Bold (700) matches the VF named instance and reads consistent with card titles; semibold was unreliable on RN + VF. */
const labelBase = {
  fontFamily: FONT_FAMILY,
  fontWeight: typography.weights.bold,
};

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
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  destructive: {
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: colors.error,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
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
    ...labelBase,
    fontSize: typography.sizes.body,
  },
  labelCompactOutline: {
    fontSize: typography.sizes.small,
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
