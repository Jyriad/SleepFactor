import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import AppToggle from './AppToggle';

/**
 * Action menu for a habit row. Uses RN Modal so it reliably stacks above
 * navigation form sheets (gorhom BottomSheetModal often fails there).
 */
export default function HabitActionsBottomSheet({
  visible,
  habit,
  onEdit,
  onDelete,
  onToggleTracking,
  onToggleLogAsNoDefault,
  onViewOverTime,
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

  if (!habit) return null;

  const isCustom = habit.is_custom === true || habit.is_custom === 'true';
  const canEdit = isCustom || habit.type === 'quick_consumption';
  const tracking = habit.is_active !== false;
  const showLogAsNo = habit.type === 'binary' || habit.type === 'quick_consumption';

  const rows = [
    canEdit && {
      key: 'edit',
      icon: 'pencil-outline',
      label: 'Edit habit',
      onPress: () => {
        dismiss();
        onEdit?.(habit);
      },
    },
    {
      key: 'tracking',
      icon: tracking ? 'pause-circle-outline' : 'play-circle-outline',
      label: tracking ? 'Pause tracking' : 'Resume tracking',
      onPress: () => {
        onToggleTracking?.(habit);
      },
    },
    showLogAsNo && {
      key: 'default-no',
      icon: 'toggle-outline',
      label:
        habit.type === 'quick_consumption'
          ? 'Log as "none" by default'
          : 'Log as "no" by default',
      isToggle: true,
      value: habit.log_as_no_by_default === true,
      onToggle: (nextValue) => onToggleLogAsNoDefault?.(habit, nextValue),
    },
    habit.id &&
      tracking && {
        key: 'timeline',
        icon: 'analytics-outline',
        label: 'View over time',
        onPress: () => {
          dismiss();
          onViewOverTime?.(habit);
        },
      },
    isCustom && {
      key: 'delete',
      icon: 'trash-outline',
      label: 'Delete habit',
      danger: true,
      onPress: () => {
        dismiss();
        onDelete?.(habit);
      },
    },
  ].filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Close menu" />
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
              sheetAnimatedStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.dragZone}>
                <View style={styles.handleWrap}>
                  <View style={styles.handle} />
                </View>
                <Text style={styles.sheetTitle}>{habit.name}</Text>
              </View>
            </GestureDetector>
            {rows.map((row) =>
              row.isToggle ? (
                <View key={row.key} style={styles.toggleRow}>
                  <Ionicons
                    name={row.icon}
                    size={22}
                    color={colors.textSecondary}
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <AppToggle value={row.value} onValueChange={row.onToggle} />
                </View>
              ) : (
                <TouchableOpacity
                  key={row.key}
                  style={styles.row}
                  onPress={row.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={row.icon}
                    size={22}
                    color={row.danger ? colors.error : colors.primary}
                    style={styles.rowIcon}
                  />
                  <Text style={[styles.rowLabel, row.danger && styles.dangerText]}>{row.label}</Text>
                </TouchableOpacity>
              )
            )}
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 41, 75, 0.45)',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.regular,
    maxHeight: '70%',
  },
  dragZone: {
    alignItems: 'center',
    minHeight: 56,
    paddingTop: spacing.xs,
  },
  handleWrap: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.regular,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.regular,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.regular,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    marginRight: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
  },
  dangerText: {
    color: colors.error,
  },
});
