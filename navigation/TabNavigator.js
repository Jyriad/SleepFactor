import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../constants/colors';
import MainTabBar from '../components/MainTabBar';
import HomeStackWrapper from './HomeStackWrapper';
import JournalStack from './JournalStack';
import SleepStack from './SleepStack';
import InsightsStack from './InsightsStack';
import { TAB_SHIFT_SCREEN_OPTIONS } from './transitionOptions';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', label: 'Home' },
  { name: 'Journal', label: 'Journal' },
  { name: 'Sleep', label: 'Sleep' },
  { name: 'Insights', label: 'Insights' },
];

function HomeTabScreen({ route }) {
  const initialNavigate = route?.params?.screen
    ? { screen: route.params.screen, params: route.params.params }
    : undefined;
  return <HomeStackWrapper initialNavigate={initialNavigate} />;
}

/**
 * Main tabs: Home → Journal → Sleep → Insights.
 */
const TabNavigator = () => (
  <Tab.Navigator
    initialRouteName="Home"
    tabBar={(props) => <MainTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      ...TAB_SHIFT_SCREEN_OPTIONS,
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
            : name === 'Journal'
              ? JournalStack
              : name === 'Sleep'
                ? SleepStack
                : InsightsStack
        }
        options={{ tabBarLabel: label }}
      />
    ))}
  </Tab.Navigator>
);

export default TabNavigator;
