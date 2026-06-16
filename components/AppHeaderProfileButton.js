import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/** Profile avatar button — opens Profile sheet from root navigator. */
export default function AppHeaderProfileButton({ style }) {
  const navigation = useNavigation();
  const { user } = useAuth();

  const initial =
    user?.email?.charAt(0)?.toUpperCase() ||
    user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
    '?';

  const openProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <TouchableOpacity
      onPress={openProfile}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel="Open profile and settings"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});
