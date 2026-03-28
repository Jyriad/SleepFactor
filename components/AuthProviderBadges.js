import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import {
  getLinkedIdentityProviders,
  formatProvidersLabel,
} from '../utils/authDisplay';

const BADGE = 28;
const OVERLAP = 10;

/**
 * Overlapping provider icons + text (Supabase-style). Pass compact for tighter spacing on profile card.
 */
const AuthProviderBadges = ({ user, compact = false, style }) => {
  const providers = getLinkedIdentityProviders(user);
  const label = formatProvidersLabel(providers);

  if (!providers.length) {
    return null;
  }

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      <View style={styles.icons}>
        {providers.map((p, i) => (
          <View
            key={`${p.key}-${i}`}
            style={[
              styles.badge,
              { marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: providers.length - i },
            ]}
            accessibilityLabel={p.label}
          >
            <Ionicons name={p.icon} size={compact ? 14 : 16} color={p.color} />
          </View>
        ))}
      </View>
      {!!label && (
        <Text
          style={[styles.label, compact && styles.labelCompact]}
          numberOfLines={1}
          accessibilityLabel={`Sign-in methods: ${label}`}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    flexWrap: 'nowrap',
  },
  rowCompact: {
    marginTop: spacing.xs,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  labelCompact: {
    fontSize: typography.sizes.xs,
  },
});

export default AuthProviderBadges;
