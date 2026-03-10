import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HomeScreen from '../screens/HomeScreen';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import SleepQualityLogScreen from '../screens/SleepQualityLogScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

const InitialNavigateContext = createContext(null);

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
 * Optional initialNavigate: { screen, params } to open a specific screen (e.g. from notifications).
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
              animation: 'slide_from_right',
              animationDuration: 220,
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
              component={HabitLoggingScreen}
              options={{ contentStyle: { backgroundColor: colors.primary } }}
            />
            <Stack.Screen
              name="SleepQualityLog"
              component={SleepQualityLogScreen}
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
});

export default HomeStackWrapper;
