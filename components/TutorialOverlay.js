import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTutorialOptional } from '../contexts/TutorialContext';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DIM = 'rgba(0,0,0,0.72)';
const PULSE_PAD = 10;

function SpotlightChrome({ rect, children }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false
    );
  }, [scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  const x = Math.max(0, rect.x - PULSE_PAD);
  const y = Math.max(0, rect.y - PULSE_PAD);
  const w = rect.width + PULSE_PAD * 2;
  const h = rect.height + PULSE_PAD * 2;
  const holeBottom = y + h;
  const holeRight = x + w;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {y > 0 ? (
        <View style={[styles.absDim, { top: 0, left: 0, width: SCREEN_W, height: y }]} />
      ) : null}
      {holeBottom < SCREEN_H ? (
        <View
          style={[styles.absDim, { top: holeBottom, left: 0, width: SCREEN_W, height: SCREEN_H - holeBottom }]}
        />
      ) : null}
      {x > 0 ? <View style={[styles.absDim, { top: y, left: 0, width: x, height: h }]} /> : null}
      {holeRight < SCREEN_W ? (
        <View
          style={[styles.absDim, { top: y, left: holeRight, width: SCREEN_W - holeRight, height: h }]}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
        }}
        pointerEvents="none"
      >
        <Animated.View style={[styles.pulseRing, { width: w, height: h }, ringStyle]} />
      </View>
      {children}
    </View>
  );
}

export default function TutorialOverlay() {
  const tutorial = useTutorialOptional();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  if (!tutorial) return null;

  const {
    storageStatus,
    phase,
    hasPendingInsight,
    pendingInsightAnalysisMode,
    spotlightRect,
    skipTutorial,
    toastVisible,
    contractModalVisible,
    dismissToast,
    dismissContractModal,
  } = tutorial;

  const pending = storageStatus === 'pending';
  const showHomeMask = pending && phase === 'home' && spotlightRect;
  const showLoggingSkip = pending && phase === 'logging';

  return (
    <>
      {showHomeMask ? (
        <View style={styles.layer} pointerEvents="box-none">
          <SpotlightChrome rect={spotlightRect}>
            <View
              style={[styles.skipWrap, { top: insets.top + spacing.sm }]}
              pointerEvents="box-none"
            >
              <TouchableOpacity onPress={skipTutorial} style={styles.skipBtn} accessibilityRole="button">
                <Text style={styles.skipText}>Skip tutorial</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.hintBubble} pointerEvents="none">
              <Text style={styles.hintTitle}>Log your habits</Text>
              <Text style={styles.hintBody}>Tap Log Habits to record today&apos;s factors.</Text>
            </View>
          </SpotlightChrome>
        </View>
      ) : null}

      {showLoggingSkip ? (
        <View style={[styles.loggingSkipLayer, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <TouchableOpacity onPress={skipTutorial} style={styles.skipBtnFloating} accessibilityRole="button">
            <Text style={styles.skipText}>Skip tutorial</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={toastVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.toastCard}>
            <Text style={styles.toastTitle}>Nice work</Text>
            <Text style={styles.toastBody}>
              You&apos;ve logged your habits for today. You&apos;ll see your first day of paired data tomorrow
              morning.
            </Text>
            <Pressable style={styles.toastBtn} onPress={dismissToast}>
              <Text style={styles.toastBtnText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={contractModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.toastCard}>
            <Text style={styles.toastTitle}>
              {hasPendingInsight ? 'An insight is waiting for you' : 'Your first insight'}
            </Text>
            {hasPendingInsight ? (
              <Text style={styles.toastBody}>
                Nice work completing setup. We already found an insight from your synced data - you can open it now on
                your Insights page.
              </Text>
            ) : (
              <>
                <Text style={styles.toastBody}>
                  One day down — keep logging for about 9 more days to unlock your first high-confidence insight.
                </Text>
                <Text style={[styles.toastBody, styles.modalSub]}>
                  Want a reminder to log before bed? You can turn that on anytime in Profile.
                </Text>
              </>
            )}
            <Pressable
              style={styles.toastBtn}
              onPress={() => {
                dismissContractModal?.();
                if (hasPendingInsight) {
                  navigation.navigate('MainTabs', {
                    screen: 'Insights',
                    params: {
                      screen: 'InsightsMain',
                      params: {
                        openFirstInsight: true,
                        preferredAnalysisMode: pendingInsightAnalysisMode,
                      },
                    },
                  });
                }
              }}
            >
              <Text style={styles.toastBtnText}>{hasPendingInsight ? 'View insight' : 'Got it'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
  },
  absDim: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  dim: {
    position: 'absolute',
    left: 0,
    backgroundColor: DIM,
  },
  pulseRing: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.white,
  },
  skipWrap: {
    position: 'absolute',
    right: spacing.regular,
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  skipText: {
    color: colors.white,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },
  hintBubble: {
    position: 'absolute',
    left: spacing.regular,
    right: spacing.regular,
    bottom: 120,
    backgroundColor: colors.cardBackground,
    padding: spacing.regular,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintTitle: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  hintBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  loggingSkipLayer: {
    position: 'absolute',
    right: spacing.regular,
    zIndex: 2000,
    elevation: 2000,
  },
  skipBtnFloating: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: BUTTON_BORDER_RADIUS,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  toastCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  toastBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.body,
  },
  modalSub: {
    marginTop: spacing.md,
  },
  toastBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  toastBtnText: {
    color: colors.white,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
});
