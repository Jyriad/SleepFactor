import React, { useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, typography, spacing, BUTTON_BORDER_RADIUS, BUTTON_SEGMENT_INNER_RADIUS } from '../constants';

export default function InsightsViewOptionsSheet({
  visible,
  layoutMode,
  analysisMode,
  onLayoutModeChange,
  onAnalysisModeChange,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible, translateY]);

  const dismiss = useCallback(() => onClose?.(), [onClose]);

  const finishClose = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldClose = event.translationY > 80 || event.velocityY > 600;
      if (shouldClose) {
        translateY.value = withTiming(screenHeight, { duration: 220 }, () => {
          runOnJS(finishClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Close view options" />
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
              sheetAnimatedStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.dragZone}>
                <View style={styles.handle} />
                <Text style={styles.title}>View options</Text>
              </View>
            </GestureDetector>

            <Text style={styles.groupLabel}>Group by</Text>
            <View style={styles.segments}>
              <TouchableOpacity
                style={[styles.segment, layoutMode === 'habit' && styles.segmentActive]}
                onPress={() => onLayoutModeChange('habit')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, layoutMode === 'habit' && styles.segmentTextActive]}>
                  Habits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, layoutMode === 'metric' && styles.segmentActive]}
                onPress={() => onLayoutModeChange('metric')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, layoutMode === 'metric' && styles.segmentTextActive]}>
                  Sleep metrics
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helper}>Habits groups by your goal. Sleep metrics groups by what changed.</Text>

            <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>View by</Text>
            <View style={styles.segments}>
              <TouchableOpacity
                style={[styles.segment, analysisMode === 'absolute' && styles.segmentActive]}
                onPress={() => onAnalysisModeChange('absolute')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, analysisMode === 'absolute' && styles.segmentTextActive]}>
                  Minutes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, analysisMode === 'percentage' && styles.segmentActive]}
                onPress={() => onAnalysisModeChange('percentage')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, analysisMode === 'percentage' && styles.segmentTextActive]}>
                  Sleep mix (%)
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helper}>Minutes shows real time. Sleep mix shows stage proportions.</Text>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.regular,
  },
  dragZone: {
    alignItems: 'center',
    minHeight: 56,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  groupLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  groupLabelSpaced: {
    marginTop: spacing.regular,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: BUTTON_BORDER_RADIUS,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: BUTTON_SEGMENT_INNER_RADIUS,
  },
  segmentActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  helper: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
});
