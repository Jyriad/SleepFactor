import { Easing } from 'react-native';

/** Matches Insights → Habit Timeline and other native stack pushes. */
export const STACK_SLIDE_DURATION_MS = 220;

export const STACK_SLIDE_SCREEN_OPTIONS = {
  animation: 'slide_from_right',
  animationDuration: STACK_SLIDE_DURATION_MS,
};

/** Bottom tabs: horizontal shift + fade (closest to stack slide between main sections). */
export const TAB_SHIFT_SCREEN_OPTIONS = {
  animation: 'shift',
  transitionSpec: {
    animation: 'timing',
    config: {
      duration: STACK_SLIDE_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
    },
  },
};

export const STACK_SLIDE_TIMING = {
  duration: STACK_SLIDE_DURATION_MS,
  useNativeDriver: true,
};
