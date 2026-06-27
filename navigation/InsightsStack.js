import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InsightsScreen from '../screens/InsightsScreen';
import InsightsBuildingHabitsScreen from '../screens/InsightsBuildingHabitsScreen';
import HabitTimelineScreen from '../screens/HabitTimelineScreen';
import { STACK_SLIDE_SCREEN_OPTIONS, SHEET_LARGE_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

const InsightsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      ...STACK_SLIDE_SCREEN_OPTIONS,
    }}
    initialRouteName="InsightsMain"
  >
    <Stack.Screen name="InsightsMain" component={InsightsScreen} />
    <Stack.Screen
      name="InsightsBuildingHabits"
      component={InsightsBuildingHabitsScreen}
      options={SHEET_LARGE_OPTIONS}
    />
    <Stack.Screen
      name="HabitTimeline"
      component={HabitTimelineScreen}
      options={SHEET_LARGE_OPTIONS}
    />
    {/* Legacy route names for deep links */}
    <Stack.Screen name="Insights" component={InsightsScreen} options={{ animation: 'none' }} />
    <Stack.Screen name="BiologyMain" component={InsightsScreen} options={{ animation: 'none' }} />
  </Stack.Navigator>
);

export default InsightsStack;
