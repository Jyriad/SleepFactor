import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HomeScreen from '../screens/HomeScreen';
import SleepQualityLogScreen from '../screens/SleepQualityLogScreen';
import SubjectiveMeasuresScreen from '../screens/SubjectiveMeasuresScreen';
import { colors } from '../constants/colors';
import { STACK_SLIDE_SCREEN_OPTIONS, SHEET_LARGE_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

const InitialNavigateContext = createContext(null);

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

const HomeStackWrapper = ({ initialNavigate }) => {
  const initialRouteName = initialNavigate?.screen ? 'InitialRedirect' : 'HomeMain';

  return (
    <InitialNavigateContext.Provider value={initialNavigate ?? null}>
      <DateHeaderProvider>
        <View style={styles.container}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              ...STACK_SLIDE_SCREEN_OPTIONS,
              contentStyle: { backgroundColor: colors.background },
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
              name="SleepQualityLog"
              component={SleepQualityLogScreen}
              options={SHEET_LARGE_OPTIONS}
            />
            <Stack.Screen
              name="SubjectiveMeasures"
              component={SubjectiveMeasuresScreen}
              options={SHEET_LARGE_OPTIONS}
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
