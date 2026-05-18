import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import { colors } from '../constants/colors';
import { STACK_SLIDE_TIMING } from './transitionOptions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STABLE_EMPTY_NAV = {
  goBack: () => {},
  navigate: () => {},
  setParams: () => {},
  canGoBack: () => false,
};

const HabitLoggingOverlayContext = createContext(null);

function overlayStateEquals(prev, next) {
  return (
    prev.visible === next.visible &&
    prev.navigation === next.navigation &&
    prev.animate === next.animate &&
    prev.params === next.params
  );
}

/**
 * Pre-mounted habit logging overlay above all tabs.
 * Shown before cross-tab navigation so Profile → Log never flashes Home underneath.
 */
export function HabitLoggingOverlayProvider({ children }) {
  const [overlayState, setOverlayState] = useState({
    visible: false,
    params: null,
    navigation: null,
    animate: true,
  });
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const hideOverlayRef = useRef(() => {});

  const setOverlay = useCallback((next) => {
    if (!next) {
      setOverlayState((prev) =>
        prev.visible
          ? { visible: false, params: null, navigation: null, animate: true }
          : prev
      );
      return;
    }
    setOverlayState((prev) => {
      const merged = {
        visible: next.visible ?? false,
        params: next.params ?? prev.params,
        navigation: next.navigation ?? prev.navigation,
        animate: next.animate !== false,
      };
      return overlayStateEquals(prev, merged) ? prev : merged;
    });
  }, []);

  const showOverlay = useCallback(
    ({ params, navigation, animate = true }) => {
      if (!animate) {
        slideAnim.setValue(0);
      }
      setOverlay({
        visible: true,
        params: params ?? {},
        navigation: navigation ?? null,
        animate,
      });
    },
    [setOverlay, slideAnim]
  );

  const hideOverlay = useCallback(() => {
    setOverlay({ visible: false, params: null, navigation: null });
  }, [setOverlay]);

  hideOverlayRef.current = hideOverlay;

  useEffect(() => {
    if (!overlayState.visible) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        ...STACK_SLIDE_TIMING,
      }).start();
      return;
    }
    if (!overlayState.animate) {
      slideAnim.setValue(0);
      return;
    }
    Animated.timing(slideAnim, {
      toValue: 0,
      ...STACK_SLIDE_TIMING,
    }).start();
  }, [overlayState.visible, overlayState.animate, slideAnim]);

  const realNav = overlayState.navigation;
  const navigation = useMemo(() => {
    if (!realNav) {
      return STABLE_EMPTY_NAV;
    }
    return {
      ...realNav,
      navigate: (...args) => {
        hideOverlayRef.current();
        return realNav.navigate(...args);
      },
      goBack: () => {
        hideOverlayRef.current();
        return realNav.goBack();
      },
    };
  }, [realNav]);

  const params = overlayState.params ?? {};
  const paramsKey = JSON.stringify(params);
  const route = useMemo(() => ({ params }), [paramsKey]);

  const contextValue = useMemo(
    () => ({ setOverlay, showOverlay, hideOverlay }),
    [setOverlay, showOverlay, hideOverlay]
  );

  return (
    <HabitLoggingOverlayContext.Provider value={contextValue}>
      {children}
      <Animated.View
        style={[
          styles.overlayContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents={overlayState.visible ? 'auto' : 'none'}
      >
        <DateHeaderProvider>
          <HabitLoggingScreen route={route} navigation={navigation} />
        </DateHeaderProvider>
      </Animated.View>
    </HabitLoggingOverlayContext.Provider>
  );
}

export function useHabitLoggingOverlay() {
  const ctx = useContext(HabitLoggingOverlayContext);
  if (!ctx) {
    throw new Error('useHabitLoggingOverlay must be used within HabitLoggingOverlayProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 200,
    backgroundColor: colors.background,
  },
});
