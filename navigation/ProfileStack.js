import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/colors';
import ProfileScreen from '../screens/ProfileScreen';
import { STACK_SLIDE_SCREEN_OPTIONS } from './transitionOptions';

const Stack = createNativeStackNavigator();

const STACK_OPTIONS = {
  headerShown: false,
  ...STACK_SLIDE_SCREEN_OPTIONS,
  contentStyle: { backgroundColor: colors.primaryDark },
};

const ProfileStack = () => (
  <Stack.Navigator screenOptions={STACK_OPTIONS} initialRouteName="ProfileMain">
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
  </Stack.Navigator>
);

export default ProfileStack;
