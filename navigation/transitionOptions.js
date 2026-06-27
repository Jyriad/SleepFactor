import { Easing, Platform } from 'react-native';

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

const IOS_SHEET_BASE = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetCornerRadius: 20,
  gestureEnabled: true,
  headerShown: false,
  // Single full detent — without this, scroll gestures bounce back instead of scrolling.
  sheetExpandsWhenScrolledToEdge: false,
  // Form sheet content must fill the detent so nested ScrollViews get a bounded height.
  contentStyle: { flex: 1 },
};

/** Full-height sheet (detail views, profile, habit management). */
export const SHEET_LARGE_OPTIONS = Platform.select({
  ios: {
    ...IOS_SHEET_BASE,
    // Numeric fractions — string 'large' crashes on current react-native-screens native bridge.
    sheetAllowedDetents: [1.0],
  },
  android: {
    presentation: 'transparentModal',
    // Opening/closing animation handled in AppSheetLayout — avoids double slide on dismiss.
    animation: 'none',
    headerShown: false,
    contentStyle: { flex: 1, backgroundColor: 'transparent' },
  },
  default: {
    presentation: 'modal',
    headerShown: false,
  },
});

/** Medium or full sheet (forms, quick tasks). */
export const SHEET_MEDIUM_LARGE_OPTIONS = Platform.select({
  ios: {
    ...IOS_SHEET_BASE,
    sheetAllowedDetents: [0.5, 1.0],
  },
  android: {
    presentation: 'transparentModal',
    // Opening/closing animation handled in AppSheetLayout — avoids double slide on dismiss.
    animation: 'none',
    headerShown: false,
    contentStyle: { flex: 1, backgroundColor: 'transparent' },
  },
  default: {
    presentation: 'modal',
    headerShown: false,
  },
});
