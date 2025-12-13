import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import sleepSyncService from '../services/sleepSyncService';

/**
 * Component that prompts users to grant health data permissions
 */
const HealthConnectPrompt = ({ onPermissionsGranted, onDismiss }) => {
  const [isRequesting, setIsRequesting] = useState(false);

  const isAndroid = Platform.OS === 'android';
  const platformName = isAndroid ? 'Health Connect' : 'Health';

  const handleRequestPermissions = async () => {
    setIsRequesting(true);
    try {
      const granted = await sleepSyncService.requestPermissions();
      if (granted) {
        onPermissionsGranted?.();
      } else {
        Alert.alert(
          'Permissions Required',
          `${platformName} permissions are needed to sync your sleep data. Please grant permissions in your device settings.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => handleRequestPermissions() },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Permission Error',
        `Unable to request ${platformName} permissions. Please check your device settings.`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const getPlatformSpecificContent = () => {
    if (isAndroid) {
      return {
        title: 'Connect Health Connect',
        description: 'Sync your sleep data from Samsung Health, Google Fit, or other health apps to see how your habits affect your sleep quality.',
        icon: 'fitness-outline',
        features: [
          'View detailed sleep stages (deep, light, REM)',
          'Track sleep duration and quality',
          'Analyze habit correlations with sleep data'
        ]
      };
    } else {
      return {
        title: 'Connect Apple Health',
        description: 'Sync your sleep data from Apple Health to analyze how your daily habits impact your sleep quality.',
        icon: 'medical-outline',
        features: [
          'Access comprehensive sleep tracking',
          'View sleep analysis and trends',
          'Correlate habits with sleep patterns'
        ]
      };
    }
  };

  const content = getPlatformSpecificContent();

  return (
    <SafeAreaView style={styles.overlay} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name={content.icon} size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.description}>{content.description}</Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What you'll get:</Text>
          {content.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            Your health data remains private and secure. We only access sleep information to provide insights about your habits.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={`Grant ${platformName} Access`}
            onPress={handleRequestPermissions}
            loading={isRequesting}
            style={styles.primaryButton}
          />
          <Button
            title="Maybe Later"
            onPress={onDismiss}
            variant="secondary"
            disabled={isRequesting}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.regular,
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
    paddingHorizontal: spacing.regular,
  },
  featuresContainer: {
    marginBottom: spacing.xxl,
  },
  featuresTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  featureText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardBackground,
    padding: spacing.regular,
    borderRadius: 12,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: typography.lineHeights.small,
  },
  buttonContainer: {
    gap: spacing.regular,
  },
  primaryButton: {
    marginBottom: spacing.sm,
  },
  secondaryButton: {
    marginBottom: spacing.lg,
  },
});

export default HealthConnectPrompt;
