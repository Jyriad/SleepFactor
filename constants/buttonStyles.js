/**
 * Single source of truth for button chrome and labels.
 * Change primary / outline / compact appearance here to update every Button instance.
 */
import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { FONT_FAMILY } from './fonts';
import { typography } from './typography';
import { spacing } from './spacing';

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
    borderRadius: 12,
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
    borderRadius: 12,
  },
  outlineRadiusCompact: {
    borderRadius: 10,
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
