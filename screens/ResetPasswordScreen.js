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
import { useNavigation } from '@react-navigation/native';
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
    // Extract tokens from URL parameters and set session
    const setupSessionFromUrl = async () => {
      try {
        console.log('🔑 ResetPasswordScreen: Setting up session from URL');
        console.log('🔑 ResetPasswordScreen: Route params:', route.params);

        // First try to get URL from route params (passed by navigation)
        let url = route.params?.url;

        // If not in route params, get from initial URL
        if (!url) {
          url = await Linking.getInitialURL();
        }

        console.log('🔑 ResetPasswordScreen: URL to process:', url);
        console.log('🔑 ResetPasswordScreen: Full URL object:', { url });

        if (url && (url.includes('#') || url.includes('access_token') || url.includes('token'))) {
          console.log('🔑 ResetPasswordScreen: URL contains auth parameters, parsing tokens...');

          // Extract access_token - try different patterns
          let accessToken = null;
          let refreshToken = null;

          // Try hash fragment first (most common)
          const hashAccessMatch = url.match(/#.*access_token=([^&]+)/);
          if (hashAccessMatch) {
            accessToken = decodeURIComponent(hashAccessMatch[1]);
          }

          // Try query param
          if (!accessToken) {
            const queryAccessMatch = url.match(/[?&]access_token=([^&]+)/);
            if (queryAccessMatch) {
              accessToken = decodeURIComponent(queryAccessMatch[1]);
            }
          }

          // Extract refresh_token - try different patterns
          const hashRefreshMatch = url.match(/#.*refresh_token=([^&]+)/);
          if (hashRefreshMatch) {
            refreshToken = decodeURIComponent(hashRefreshMatch[1]);
          }

          if (!refreshToken) {
            const queryRefreshMatch = url.match(/[?&]refresh_token=([^&]+)/);
            if (queryRefreshMatch) {
              refreshToken = decodeURIComponent(queryRefreshMatch[1]);
            }
          }

          console.log('🔑 ResetPasswordScreen: Extracted tokens:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            accessTokenLength: accessToken?.length,
            refreshTokenLength: refreshToken?.length
          });

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Error setting session:', error);
              Alert.alert('Error', 'Invalid or expired reset link. Please request a new password reset.');
              navigation.replace('Auth');
              return;
            }

            setSessionSet(true);
          } else {
            Alert.alert('Error', 'Invalid reset link. Please request a new password reset.');
            navigation.replace('Auth');
          }
        } else {
          console.log('🔑 ResetPasswordScreen: No valid URL found');
          Alert.alert('Error', 'Invalid reset link. Please request a new password reset.');
          navigation.replace('Auth');
        }
      } catch (error) {
        console.error('Error processing reset link:', error);
        Alert.alert('Error', 'Failed to process reset link. Please try again.');
        navigation.replace('Auth');
      }
    };

    setupSessionFromUrl();
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
            onPress: () => navigation.replace('MainTabs')
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
