import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { typography, spacing } from '../../constants';
import Button from '../../components/Button';

export default function OnboardingStepLayout({
  step,
  totalSteps,
  title,
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Next',
  showSkip = true,
  nextLoading = false,
}) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>
          {step} of {totalSteps}
        </Text>
        {showSkip && onSkip ? (
          <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.content}>{children}</View>
      <View style={styles.footer}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <Button
          title={nextLabel}
          onPress={onNext}
          loading={nextLoading}
          disabled={nextLoading}
          style={[styles.nextButton, !onBack && styles.nextButtonFull]}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  stepIndicator: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  skipText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.regular,
    paddingVertical: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
  },
  backButtonText: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  nextButton: {
    flex: 1,
  },
  nextButtonFull: {
    flex: 1,
  },
});
