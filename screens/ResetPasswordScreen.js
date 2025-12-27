import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';

const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionSet, setSessionSet] = useState(false);

  useEffect(() => {
    console.log('🔑 [ResetPasswordScreen] Component mounted/updated');

    // Extract tokens from URL parameters and set session
    const setupSessionFromUrl = async () => {
      try {
        console.log('🔑 [ResetPasswordScreen] Setting up session from URL');
        console.log('🔑 [ResetPasswordScreen] Route name:', route.name);
        console.log('🔑 [ResetPasswordScreen] Route params:', route.params);
        console.log('🔑 [ResetPasswordScreen] Route params keys:', route.params ? Object.keys(route.params) : 'NO_PARAMS');
        console.log('🔑 [ResetPasswordScreen] Full route object:', JSON.stringify(route, null, 2));

        // Get URL from route params (passed by React Navigation deep linking)
        const url = route.params?.url;
        console.log('🔑 [ResetPasswordScreen] URL from params:', url);

        // Also check if there's a code parameter directly
        const directCode = route.params?.code;
        console.log('🔑 [ResetPasswordScreen] Direct code param:', directCode);

        if (!url) {
          console.error('❌ No URL provided to ResetPasswordScreen');
          Alert.alert('Error', 'Invalid reset link. Please request a new password reset.');
          // Don't try to navigate - let the auth state change handler manage navigation
          // This prevents conflicts with the main navigation reset logic
          console.log('ℹ️ [ResetPasswordScreen] Not navigating - letting auth state handler manage navigation');
          return;
        }

        // Extract code from the URL
        const codeMatch = url.match(/[?&]code=([^&]+)/);
        if (!codeMatch) {
          console.error('❌ No code found in URL:', url);
          Alert.alert('Error', 'Invalid reset link. Please request a new password reset.');
          // Don't navigate - let user manually go back
          return;
        }

        const code = decodeURIComponent(codeMatch[1]);
        console.log('🔑 ResetPasswordScreen: Extracted code:', code);

        console.log('🔑 ResetPasswordScreen: Exchanging code for session...');

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Error exchanging code for session:', error);
          Alert.alert('Error', 'Invalid or expired reset link. Please request a new password reset.');
          // Don't navigate - let user manually go back
          return;
        }

        console.log('🔑 ResetPasswordScreen: Session established successfully');
        setSessionSet(true);
      } catch (error) {
        console.error('Error processing reset link:', error);
        Alert.alert('Error', 'Failed to process reset link. Please try again.');
        // Don't navigate - let user manually go back
      }
    };

    setupSessionFromUrl();

    // Cleanup effect to track unmounting
    return () => {
      console.log('🔑 [ResetPasswordScreen] Component unmounting');
    };
  }, [navigation, route.params]);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your password has been reset successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack() // Let user go back manually
          }
        ]
      );
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionSet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Setting up password reset...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.description}>
          Enter your new password below. Make sure it's at least 6 characters long.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={colors.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Button
          title="Reset Password"
          onPress={handleResetPassword}
          loading={loading}
          style={styles.resetButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
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
    paddingTop: spacing.lg,
  },
  description: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    backgroundColor: colors.cardBackground,
  },
  resetButton: {
    marginTop: spacing.lg,
  },
});

export default ResetPasswordScreen;
