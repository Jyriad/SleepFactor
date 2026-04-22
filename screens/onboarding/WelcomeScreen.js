import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BannerLogoLight from '../../assets/BannerLogoLight.svg';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

// Matches BannerLogoLight.svg viewBox (primary horizontal wordmark)
const BANNER_ASPECT_RATIO = 1284.55 / 226.95;
const BANNER_MAX_WIDTH = 168;

function EquationBox({ title, subtitle, children }) {
  return (
    <View style={styles.eqBox}>
      <View style={styles.eqTitleRow}>
        <Text style={styles.eqBoxTitle}>{title}</Text>
        <View style={styles.eqIconRow}>{children}</View>
      </View>
      <Text style={styles.eqBoxSub}>{subtitle}</Text>
    </View>
  );
}

const WelcomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - spacing.xl * 2;
  const bannerWidth = Math.min(BANNER_MAX_WIDTH, contentWidth);
  const bannerHeight = bannerWidth / BANNER_ASPECT_RATIO;

  const goToAuth = () => navigation.navigate('OnboardingAuth');
  const continueSetup = () => navigation.replace('OnboardingIntroStat');

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BannerLogoLight
          width={bannerWidth}
          height={bannerHeight}
          style={styles.banner}
          accessibilityLabel="SleepFactor"
        />
        <Text style={styles.headline}>
          Ever wondered what factors are impacting your sleep? SleepFactor can help.
        </Text>

        <EquationBox
          title="Wearable data"
          subtitle="Automatically sync sleep data from your wearable"
        >
          <Ionicons name="logo-apple" size={24} color={colors.textPrimary} />
          <Ionicons name="logo-google" size={24} color={colors.textPrimary} />
          <Ionicons name="watch-outline" size={24} color={colors.primary} />
        </EquationBox>

        <View style={styles.connector} />
        <View style={styles.opWrap}>
          <Text style={styles.op}>+</Text>
        </View>
        <View style={styles.connector} />

        <EquationBox title="Your habits" subtitle="Tell SleepFactor which habits you do each day">
          <Ionicons name="list-outline" size={26} color={colors.primary} />
        </EquationBox>

        <View style={styles.connector} />
        <View style={styles.opWrap}>
          <Text style={styles.op}>=</Text>
        </View>
        <View style={styles.connector} />

        <EquationBox
          title="Morning feelings"
          subtitle="Add a quick check-in so your subjective experience is included"
        >
          <Ionicons name="sunny-outline" size={24} color={colors.primary} />
          <Ionicons name="happy-outline" size={24} color={colors.textPrimary} />
        </EquationBox>

        <View style={styles.connector} />
        <View style={styles.opWrap}>
          <Text style={styles.op}>=</Text>
        </View>
        <View style={styles.connector} />

        <EquationBox
          title="Deeper insights"
          subtitle="We analyse how your habits, watch data, and feelings move together"
        >
          <Ionicons name="analytics-outline" size={26} color={colors.primary} />
        </EquationBox>

        <View style={styles.footer}>
          <Button title="Get started" onPress={goToAuth} style={styles.primaryButton} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  banner: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  eqBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  eqBoxTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  eqIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexShrink: 0,
  },
  eqBoxSub: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
    marginTop: 0,
  },
  op: {
    fontSize: 26,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  opWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary + '44',
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
    marginVertical: spacing.xs,
  },
  connector: {
    width: 1,
    height: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.primary + '33',
    borderRadius: 1,
  },
  footer: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    maxWidth: 360,
    width: '100%',
  },
  primaryButton: {
    alignSelf: 'stretch',
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  signOutWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});

export default WelcomeScreen;
