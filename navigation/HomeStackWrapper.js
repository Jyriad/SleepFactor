import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HomeScreen from '../screens/HomeScreen';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import LogConsumptionScreen from '../screens/LogConsumptionScreen';
import SleepQualityLogScreen from '../screens/SleepQualityLogScreen';
import SubjectiveMeasuresScreen from '../screens/SubjectiveMeasuresScreen';
import { colors } from '../constants/colors';
import { formatDateForDB } from '../utils/dateHelpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const Stack = createNativeStackNavigator();

const InitialNavigateContext = createContext(null);

const PreMountedHabitLoggingContext = createContext(null);

/**
 * Lightweight stack screen that triggers the pre-mounted overlay and provides route/navigation.
 * When this mounts, the overlay (already-mounted HabitLoggingScreen) is shown instantly (no slide animation).
 */
function HabitLoggingRouteWrapper() {
  const navigation = useNavigation();
  const route = useRoute();
  const setOverlay = useContext(PreMountedHabitLoggingContext);

  useEffect(() => {
    if (!setOverlay) return;
    setOverlay({
      visible: true,
      params: route.params ?? {},
      navigation,
    });
    return () => {
      setOverlay({ visible: false, params: null, navigation: null });
    };
  }, [setOverlay, route.params, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!setOverlay) return;
      setOverlay({
        visible: true,
        params: route.params ?? {},
        navigation,
      });
    }, [setOverlay, route.params, navigation])
  );

  return <View style={styles.placeholderScreen} />;
}

/**
 * Provider that keeps HabitLoggingScreen mounted in an off-screen overlay so it's ready when the user taps "Log habits".
 * When the user navigates to HabitLogging, the overlay is shown instantly (no slide animation).
 */
function PreMountedHabitLoggingProvider({ children }) {
  const [overlayState, setOverlayState] = useState({
    visible: false,
    params: null,
    navigation: null,
  });
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const setOverlay = useCallback((next) => {
    setOverlayState((prev) => {
      const visible = next?.visible ?? false;
      const params = next?.params ?? null;
      const navigation = next?.navigation ?? null;
      return { visible, params, navigation };
    });
  }, []);

  useEffect(() => {
    slideAnim.setValue(overlayState.visible ? 0 : SCREEN_WIDTH);
  }, [overlayState.visible, slideAnim]);

  const defaultParams = { date: formatDateForDB(new Date()) };
  const params = overlayState.params ?? defaultParams;
  const realNav = overlayState.navigation ?? { goBack: () => {}, navigate: () => {} };
  const navigation = realNav
    ? {
        ...realNav,
        navigate: (name, paramsOrOptions) => {
          setOverlay({ visible: false, params: null, navigation: null });
          realNav.navigate(name, paramsOrOptions);
        },
      }
    : realNav;

  return (
    <PreMountedHabitLoggingContext.Provider value={setOverlay}>
      {children}
      <Animated.View
        style={[
          styles.overlayContainer,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
        pointerEvents={overlayState.visible ? 'auto' : 'none'}
      >
        <HabitLoggingScreen
          route={{ params }}
          navigation={navigation}
        />
      </Animated.View>
    </PreMountedHabitLoggingContext.Provider>
  );
}

/**
 * Invisible screen used when opening Home stack to a specific screen (e.g. from a notification).
 * Reads initialNavigate from context and replaces with the target screen.
 */
function InitialRedirectScreen() {
  const navigation = useNavigation();
  const initialNavigate = useContext(InitialNavigateContext);
  const done = useRef(false);

  useEffect(() => {
    if (!initialNavigate?.screen || done.current) return;
    done.current = true;
    navigation.replace(initialNavigate.screen, initialNavigate.params ?? {});
  }, [initialNavigate, navigation]);

  return null;
}

/**
 * Wraps the Home tab content. The date header at top has a 7-day strip and a handle;
 * swiping down or tapping the handle expands the calendar inline below the header.
 * HabitLoggingScreen is pre-mounted in an overlay so "Log habits" opens instantly.
 */
const HomeStackWrapper = ({ initialNavigate }) => {
  const initialRouteName =
    initialNavigate?.screen ? 'InitialRedirect' : 'HomeMain';

  return (
    <InitialNavigateContext.Provider value={initialNavigate ?? null}>
      <DateHeaderProvider>
        <PreMountedHabitLoggingProvider>
          <View style={styles.container}>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 150,
              }}
              initialRouteName={initialRouteName}
            >
              <Stack.Screen
                name="InitialRedirect"
                component={InitialRedirectScreen}
                options={{ animation: 'none' }}
              />
              <Stack.Screen name="HomeMain" component={HomeScreen} />
              <Stack.Screen
                name="HabitLogging"
                component={HabitLoggingRouteWrapper}
                options={{
                  animation: 'none',
                  contentStyle: { backgroundColor: colors.primaryDark },
                }}
              />
              <Stack.Screen
                name="LogConsumption"
                component={LogConsumptionScreen}
                options={{
                  animation: 'none',
                  contentStyle: { backgroundColor: colors.cardBackground },
                }}
              />
              <Stack.Screen
                name="SleepQualityLog"
                component={SleepQualityLogScreen}
                options={{ contentStyle: { backgroundColor: colors.background } }}
              />
              <Stack.Screen
                name="SubjectiveMeasures"
                component={SubjectiveMeasuresScreen}
                options={{ contentStyle: { backgroundColor: colors.background } }}
              />
            </Stack.Navigator>
          </View>
        </PreMountedHabitLoggingProvider>
      </DateHeaderProvider>
    </InitialNavigateContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlayContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    backgroundColor: colors.primaryDark,
  },
  placeholderScreen: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
});

export default HomeStackWrapper;
