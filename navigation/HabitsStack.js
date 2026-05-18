import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import HabitManagementScreen from '../screens/HabitManagementScreen';
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

const STACK_OPTIONS = {
  headerShown: false,
  ...STACK_SLIDE_SCREEN_OPTIONS,
  contentStyle: { backgroundColor: colors.primaryDark },
};

const HabitsStack = () => (
  <Stack.Navigator screenOptions={STACK_OPTIONS} initialRouteName="HabitManagement">
    <Stack.Screen name="HabitManagement" component={HabitManagementScreen} />
  </Stack.Navigator>
);

export default HabitsStack;
