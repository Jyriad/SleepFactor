import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BannerLogoLight from '../../assets/BannerLogoLight.svg';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

const BANNER_ASPECT_RATIO = 250 / 100;
const BANNER_MAX_WIDTH = 168;

/** One short line each — numbered list, no cards, fits typical phones without scrolling */
const WELCOME_LINES = [
  'Track your sleep automatically from your wearable.',
  'Log caffeine, alcohol, and other habits.',
  'See what helps or hurts your sleep.',
];

const WelcomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - spacing.xl * 2;
  const bannerWidth = Math.min(BANNER_MAX_WIDTH, contentWidth);
  const bannerHeight = bannerWidth / BANNER_ASPECT_RATIO;

  const goToAuth = () => navigation.navigate('OnboardingAuth');
  const continueSetup = () => navigation.replace('OnboardingHealth');

  if (user?.id) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <BannerLogoLight
            width={bannerWidth}
            height={bannerHeight}
            style={styles.banner}
            accessibilityLabel="SleepFactor"
          />
          <Text style={styles.resumeTitle}>You&apos;re signed in</Text>
          <Text style={styles.resumeBody}>
            Continue setup, or tap Leave to sign out and go back to the start.
          </Text>
          <Button title="Continue setup" onPress={continueSetup} style={styles.primaryButton} />
          <View style={styles.signOutWrap}>
            <OnboardingSignOutLink />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <BannerLogoLight
          width={bannerWidth}
          height={bannerHeight}
          style={styles.banner}
          accessibilityLabel="SleepFactor"
        />
        <View style={styles.pointsBlock}>
          {WELCOME_LINES.map((line, i) => (
            <Text
              key={i}
              style={styles.pointLine}
              accessible
              accessibilityRole="text"
            >
              <Text style={styles.pointNum}>{i + 1}. </Text>
              <Text style={styles.pointText}>{line}</Text>
            </Text>
          ))}
        </View>
        <View style={styles.footer}>
          <Button title="Get started" onPress={goToAuth} style={styles.primaryButton} />
          <TouchableOpacity onPress={goToAuth} style={styles.signInLink} accessibilityRole="button">
            <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  banner: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  pointsBlock: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
  },
  pointLine: {
    marginBottom: spacing.sm,
    lineHeight: typography.lineHeights.small,
  },
  pointNum: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  pointText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  footer: {
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingBottom: spacing.sm,
    maxWidth: 360,
    width: '100%',
  },
  primaryButton: {
    minWidth: 200,
    alignSelf: 'stretch',
  },
  signInLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  signInLinkText: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  resumeTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resumeBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  signOutWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});

export default WelcomeScreen;
