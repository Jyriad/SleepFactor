import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../constants/colors';
import MainTabBar from '../components/MainTabBar';
import HomeStackWrapper from './HomeStackWrapper';
import InsightsStack from './InsightsStack';
import HabitsStack from './HabitsStack';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', label: 'Home' },
  { name: 'Insights', label: 'Insights' },
  { name: 'Habits', label: 'Habits' },
  { name: 'Profile', label: 'Profile' },
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
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarHideOnKeyboard: true,
        lazy: true,
        unmountOnBlur: false,
      }}
    >
      {TAB_CONFIG.map(({ name, label }) => (
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
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default TabNavigator;
