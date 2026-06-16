import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DateHeaderProvider } from '../contexts/DateHeaderContext';
import HabitLoggingScreen from '../screens/HabitLoggingScreen';
import HabitManagementScreen from '../screens/HabitManagementScreen';
import LogConsumptionScreen from '../screens/LogConsumptionScreen';
import AddHabitScreen from '../screens/AddHabitScreen';
import EditHabitScreen from '../screens/EditHabitScreen';
import DeleteHabitScreen from '../screens/DeleteHabitScreen';
import { colors } from '../constants/colors';
import {
  STACK_SLIDE_SCREEN_OPTIONS,
  SHEET_LARGE_OPTIONS,
} from './transitionOptions';

const Stack = createNativeStackNavigator();

const JournalStack = () => (
  <DateHeaderProvider>
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...STACK_SLIDE_SCREEN_OPTIONS,
        contentStyle: { backgroundColor: colors.background },
      }}
      initialRouteName="JournalMain"
    >
      <Stack.Screen name="JournalMain" component={HabitLoggingScreen} />
      <Stack.Screen
        name="HabitManagement"
        component={HabitManagementScreen}
        options={SHEET_LARGE_OPTIONS}
      />
      <Stack.Screen
        name="LogConsumption"
        component={LogConsumptionScreen}
        options={SHEET_LARGE_OPTIONS}
      />
      <Stack.Screen name="AddHabit" component={AddHabitScreen} options={SHEET_LARGE_OPTIONS} />
      <Stack.Screen name="EditHabit" component={EditHabitScreen} options={SHEET_LARGE_OPTIONS} />
      <Stack.Screen name="DeleteHabit" component={DeleteHabitScreen} options={SHEET_LARGE_OPTIONS} />
    </Stack.Navigator>
  </DateHeaderProvider>
);

export default JournalStack;
