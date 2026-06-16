import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import SleepScreen from '../screens/SleepScreen';
import SleepQualityLogScreen from '../screens/SleepQualityLogScreen';
import SubjectiveMeasuresScreen from '../screens/SubjectiveMeasuresScreen';
import { colors } from '../constants/colors';
import {
  STACK_SLIDE_SCREEN_OPTIONS,
  SHEET_LARGE_OPTIONS,
} from './transitionOptions';

const Stack = createNativeStackNavigator();

const SleepStack = () => (
  <DateHeaderProvider>
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...STACK_SLIDE_SCREEN_OPTIONS,
        contentStyle: { backgroundColor: colors.background },
      }}
      initialRouteName="SleepMain"
    >
      <Stack.Screen name="SleepMain" component={SleepScreen} />
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
  </DateHeaderProvider>
);

export default SleepStack;
