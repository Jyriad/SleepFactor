import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const InsightsScreen = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Insights</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>How your daily habits shape your night.</Text>

          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Coming Soon</Text>
            <Text style={styles.placeholderText}>
              Log habits for at least 7 days to see insights
            </Text>
            <Text style={styles.placeholderSubtext}>
              We'll analyze how your habits affect your sleep quality and provide personalized recommendations.
            </Text>
          </View>
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
  header: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.regular,
  },
  subtitle: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  placeholderCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  placeholderTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  placeholderText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  placeholderSubtext: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default InsightsScreen;

