import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signUp, signIn, signInWithGoogle } from '../services/auth';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import Button from '../components/Button';
import BannerLogoLight from '../assets/BannerLogoLight.svg';

const BANNER_ASPECT_RATIO = 250 / 100; // 2.5:1
const BANNER_MAX_WIDTH = 200; // Slightly smaller so more content fits above the fold

const AuthScreen = () => {
  const { width: windowWidth } = useWindowDimensions();
  const bannerWidth = Math.min(BANNER_MAX_WIDTH, windowWidth - spacing.xl * 2);
  const bannerHeight = bannerWidth / BANNER_ASPECT_RATIO;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState({ google: false });

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (email && !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError);
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setOauthLoading(prev => ({ ...prev, google: true }));
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError);
      }
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setOauthLoading(prev => ({ ...prev, google: false }));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <BannerLogoLight
              width={bannerWidth}
              height={bannerHeight}
              style={styles.bannerLogo}
              accessibilityLabel="SleepFactor"
            />
            <Text style={styles.subtitle}>
              Track your habits and improve your sleep
            </Text>

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggle, !isSignUp && styles.activeToggle]}
                onPress={() => {
                  setIsSignUp(false);
                  setError('');
                }}
              >
                <Text style={[styles.toggleText, !isSignUp && styles.activeToggleText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, isSignUp && styles.activeToggle]}
                onPress={() => {
                  setIsSignUp(true);
                  setError('');
                }}
              >
                <Text style={[styles.toggleText, isSignUp && styles.activeToggleText]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    style={styles.showPasswordButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Always render confirm password field with fixed height to prevent layout shift */}
              <View style={[
                styles.inputContainer,
                !isSignUp && styles.hiddenContainer
              ]}>
                <Text style={[styles.label, !isSignUp && styles.hiddenText]}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textLight}
                  value={isSignUp ? confirmPassword : ''}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={isSignUp}
                />
              </View>

              {/* Always render error container to prevent layout shift */}
              <View style={styles.errorContainer}>
                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}
              </View>

              <Button
                title={isSignUp ? 'Sign Up' : 'Sign In'}
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>

              {/* OAuth Buttons */}
              <Button
                title="Continue with Google"
                onPress={handleGoogleSignIn}
                loading={oauthLoading.google}
                variant="secondary"
                style={styles.oauthButton}
                icon={<Ionicons name="logo-google" size={20} color={colors.primary} style={styles.icon} />}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg, // Tighter top so logo and form sit higher, more above the fold
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  bannerLogo: {
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.regular,
  },
  toggle: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  hiddenContainer: {
    opacity: 0,
    height: 72, // Fixed height to match visible input (label + input + margin), slightly tighter
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  hiddenText: {
    opacity: 0,
  },
  label: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    paddingRight: 50, // Space for eye icon
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  showPasswordButton: {
    position: 'absolute',
    right: spacing.regular,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  errorContainer: {
    minHeight: 20,
    marginBottom: spacing.md,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: typography.sizes.small,
    color: colors.error,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.regular,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  oauthButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.regular,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
});

export default AuthScreen;

