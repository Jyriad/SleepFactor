import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InsightsScreen from '../screens/InsightsScreen';

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
    </Stack.Navigator>
  );
};

export default InsightsStack;
