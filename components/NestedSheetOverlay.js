import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/colors';
import { spacing } from '../constants';

/**
 * Second sheet layer inside an existing form sheet (e.g. Add habit over Manage habits).
 * Drag the handle at the top down to slide away and reveal Manage habits underneath.
 */
export default function NestedSheetOverlay({ visible, onClose, children }) {
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(screenHeight);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else {
      translateY.value = screenHeight;
    }
  }, [visible, screenHeight, translateY]);

  const finishClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

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

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Animated.View style={[styles.root, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.dragZone}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const SHEET_TOP_RADIUS = 20;

const styles = StyleSheet.create({
  gestureRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  root: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  dragZone: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  body: {
    flex: 1,
  },
});
