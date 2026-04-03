import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const STACK_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 220,
  contentStyle: { backgroundColor: colors.primaryDark },
};

const ProfileStack = () => (
  <Stack.Navigator screenOptions={STACK_OPTIONS} initialRouteName="ProfileMain">
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
  </Stack.Navigator>
);

export default ProfileStack;
