import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { colors } from '../constants/colors';
import { buttonStyles } from '../constants/buttonStyles';

/**
 * @param {'primary'|'secondary'|'destructive'|'outline'} [variant='primary']
 * @param {'default'|'compact'} [size='default'] — compact tightens padding; outline+compact uses smaller label (home sleep CTA).
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
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDestructive = variant === 'destructive';
  const isOutline = variant === 'outline';
  const isCompact = size === 'compact';

  const spinnerColor =
    isPrimary || isDestructive ? '#FFFFFF' : colors.primary;

  return (
    <TouchableOpacity
      style={[
        buttonStyles.container,
        isCompact && buttonStyles.containerCompact,
        isPrimary && buttonStyles.primary,
        isSecondary && buttonStyles.secondary,
        isDestructive && buttonStyles.destructive,
        isOutline && buttonStyles.outline,
        isOutline && (isCompact ? buttonStyles.outlineRadiusCompact : buttonStyles.outlineRadiusDefault),
        disabled && buttonStyles.disabled,
        icon && buttonStyles.containerWithIcon,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              buttonStyles.label,
              isOutline && isCompact && buttonStyles.labelCompactOutline,
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
    </TouchableOpacity>
  );
};

export default Button;
