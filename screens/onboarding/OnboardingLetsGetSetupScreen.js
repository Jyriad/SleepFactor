import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

export default function OnboardingLetsGetSetupScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.step}>Step 4</Text>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>Let&apos;s get you set up</Text>
        <View style={styles.iconWrap}>
          <Ionicons name="pulse-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.body}>
          SleepFactor pairs what you do during the day with how you sleep.{' '}
          {Platform.OS === 'ios'
            ? 'On iPhone, sleep sync uses Apple Health — that powers your charts and insights.'
            : 'On Android, sleep sync uses Google Health Connect — that powers your charts and insights.'}
        </Text>
        <Text style={styles.muted}>
          Next, you&apos;ll grant read access. We only use sleep-related data you approve.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title="Connect sleep data"
          onPress={() => navigation.navigate('OnboardingSleepSourcePicker')}
          style={styles.btn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  step: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  muted: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.small,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
