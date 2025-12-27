import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(
        'Password Updated',
        'Your password has been successfully updated!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MainTabs')
          }
        ]
      );
    } catch (error) {
      console.error('Password update error:', error);
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Reset Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.primary} />
        </View>

        <Text style={styles.description}>
          Enter your new password below. Make sure it's secure and easy to remember.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>New Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <Text style={styles.inputValue}>
              {newPassword ? '•'.repeat(Math.min(newPassword.length, 12)) : 'Enter new password'}
            </Text>
            <TouchableOpacity
              style={styles.inputAction}
              onPress={() => {
                // In a real app, this would open a secure password input
                Alert.alert('Password Input', 'Enter your new password:', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'OK',
                    onPress: (password) => password && setNewPassword(password)
                  }
                ]);
              }}
            >
              <Ionicons name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <Text style={styles.inputValue}>
              {confirmPassword ? '•'.repeat(Math.min(confirmPassword.length, 12)) : 'Confirm new password'}
            </Text>
            <TouchableOpacity
              style={styles.inputAction}
              onPress={() => {
                Alert.alert('Password Input', 'Confirm your new password:', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'OK',
                    onPress: (password) => password && setConfirmPassword(password)
                  }
                ]);
              }}
            >
              <Ionicons name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title="Update Password"
          onPress={handlePasswordReset}
          loading={loading}
          style={styles.updateButton}
        />

        <Text style={styles.hint}>
          Password must be at least 6 characters long and contain a mix of letters and numbers for security.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  description: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  inputValue: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  inputAction: {
    padding: spacing.xs,
  },
  updateButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  hint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ResetPasswordScreen;
