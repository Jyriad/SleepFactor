import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import HomeStackWrapper from './HomeStackWrapper';
import InsightsScreen from '../screens/InsightsScreen';
import HabitManagementScreen from '../screens/HabitManagementScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Use primary as screen root background so the area above the blue header is never white
// (avoids white strip when native layer or safe area adds top padding)
const tabScreenTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.primary,
  },
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      theme={tabScreenTheme}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Insights') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Habits') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          paddingBottom: 5,
          paddingTop: 2,
          position: 'absolute',
          bottom: 0,
          height: 60,
          borderTopWidth: 0,
          borderBottomWidth: 0,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        // Ensure screen container is blue so any top padding area matches the header
        sceneStyle: { backgroundColor: colors.primary },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackWrapper} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Habits" component={HabitManagementScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default TabNavigator;

