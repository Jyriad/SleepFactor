import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InsightsScreen from '../screens/InsightsScreen';
import HabitTimelineScreen from '../screens/HabitTimelineScreen';
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

const InsightsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...STACK_SLIDE_SCREEN_OPTIONS,
      }}
      initialRouteName="Insights"
    >
      <Stack.Screen name="Insights" component={InsightsScreen} />
      <Stack.Screen name="HabitTimeline" component={HabitTimelineScreen} />
    </Stack.Navigator>
  );
};

export default InsightsStack;
