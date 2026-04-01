import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';
import OnboardingSignOutLink from './OnboardingSignOutLink';

export default function OnboardingIntroStatScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.step}>Step 1</Text>
          <OnboardingSignOutLink />
        </View>
        <Text style={styles.title}>You&apos;re not alone</Text>
        <Text style={styles.body}>
          Did you know 75% of people have made changes to their life to try and improve their sleep?
        </Text>
        <Text style={styles.body}>
          We&apos;ll help you understand what&apos;s impacting your sleep — whether that&apos;s analysing whether any
          supplements you&apos;re taking are actually doing anything, to seeing how changes in your lifestyle can help
          you sleep longer, deeper, or more efficiently.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Next" onPress={() => navigation.navigate('OnboardingGoalQuiz')} style={styles.btn} />
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
  body: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  btn: {
    alignSelf: 'stretch',
  },
});
