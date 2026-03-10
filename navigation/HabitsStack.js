import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import HabitManagementScreen from '../screens/HabitManagementScreen';

const Stack = createNativeStackNavigator();

const STACK_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 220,
  contentStyle: { backgroundColor: colors.primary },
};

const HabitsStack = () => (
  <Stack.Navigator screenOptions={STACK_OPTIONS} initialRouteName="HabitManagement">
    <Stack.Screen name="HabitManagement" component={HabitManagementScreen} />
  </Stack.Navigator>
);

export default HabitsStack;
