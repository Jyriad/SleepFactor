import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import HomeStackWrapper from './HomeStackWrapper';
import InsightsStack from './InsightsStack';
import HabitsStack from './HabitsStack';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
  { name: 'Insights', icon: 'bar-chart', iconOutline: 'bar-chart-outline', label: 'Insights' },
  { name: 'Habits', icon: 'list', iconOutline: 'list-outline', label: 'Habits' },
  { name: 'Profile', icon: 'person', iconOutline: 'person-outline', label: 'Profile' },
];

/**
 * Home tab screen: passes tab route params to HomeStackWrapper so notifications
 * can open MainTabs → Home → HabitLogging (or SleepQualityLog) via initialNavigate.
 */
function HomeTabScreen({ route }) {
  const initialNavigate = route?.params?.screen
    ? { screen: route.params.screen, params: route.params.params }
    : undefined;
  return <HomeStackWrapper initialNavigate={initialNavigate} />;
}

/**
 * Main tabs: one stack per tab. Lazy: only Home mounts at first paint; other tabs mount on first open
 * (faster cold start). unmountOnBlur: false keeps each tab mounted after first visit so switching back is instant.
 */
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(insets.bottom, 5) + 5;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          height: 60 + tabBarBottomPadding,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarHideOnKeyboard: true,
        lazy: true,
        unmountOnBlur: false,
      }}
    >
      {TAB_CONFIG.map(({ name, icon, iconOutline, label }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={
            name === 'Home'
              ? HomeTabScreen
              : name === 'Insights'
                ? InsightsStack
                : name === 'Habits'
                  ? HabitsStack
                  : ProfileStack
          }
          options={{
            tabBarLabel: label,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? icon : iconOutline}
                size={size ?? 24}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default TabNavigator;
