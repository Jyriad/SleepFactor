import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HomeScreen from '../screens/HomeScreen';
import LogConsumptionScreen from '../screens/LogConsumptionScreen';
import SleepQualityLogScreen from '../screens/SleepQualityLogScreen';
import SubjectiveMeasuresScreen from '../screens/SubjectiveMeasuresScreen';
import { colors } from '../constants/colors';
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';
import { useHabitLoggingOverlay } from './HabitLoggingOverlayHost';

const Stack = createNativeStackNavigator();

const InitialNavigateContext = createContext(null);

function habitLoggingParamsKey(params) {
  if (!params) return '';
  return JSON.stringify({
    date: params.date,
    pendingQuickLog: params.pendingQuickLog,
    pendingActionToken: params.pendingActionToken,
    overlayInstant: params._overlayInstant,
  });
}

/**
 * Syncs the tab-level habit logging overlay with this stack route.
 */
function HabitLoggingRouteWrapper() {
  const navigation = useNavigation();
  const route = useRoute();
  const { setOverlay } = useHabitLoggingOverlay();
  const paramsKey = habitLoggingParamsKey(route.params);

  useFocusEffect(
    React.useCallback(() => {
      const stackParams = route.params ?? {};
      setOverlay({
        visible: true,
        params: stackParams,
        navigation,
        animate: !stackParams._overlayInstant,
      });
      return () => {
        setOverlay({ visible: false, params: null, navigation: null });
      };
    }, [setOverlay, paramsKey, navigation])
  );

  return <View style={styles.placeholderScreen} />;
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
 */
const HomeStackWrapper = ({ initialNavigate }) => {
  const initialRouteName =
    initialNavigate?.screen ? 'InitialRedirect' : 'HomeMain';

  return (
    <InitialNavigateContext.Provider value={initialNavigate ?? null}>
      <DateHeaderProvider>
        <View style={styles.container}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              ...STACK_SLIDE_SCREEN_OPTIONS,
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
                contentStyle: { backgroundColor: colors.background },
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
      </DateHeaderProvider>
    </InitialNavigateContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderScreen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default HomeStackWrapper;
