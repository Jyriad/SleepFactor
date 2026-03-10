import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InsightsScreen from '../screens/InsightsScreen';
import DetailedInsightsScreen from '../screens/DetailedInsightsScreen';

const Stack = createNativeStackNavigator();

const InsightsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 220,
      }}
      initialRouteName="Insights"
    >
      <Stack.Screen name="Insights" component={InsightsScreen} />
      <Stack.Screen name="DetailedInsights" component={DetailedInsightsScreen} />
    </Stack.Navigator>
  );
};

export default InsightsStack;
