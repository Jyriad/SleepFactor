import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

const TAB_CONFIG = [
  { name: 'Home', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
  { name: 'Insights', icon: 'bar-chart', iconOutline: 'bar-chart-outline', label: 'Insights' },
  { name: 'Habits', icon: 'list', iconOutline: 'list-outline', label: 'Habits' },
  { name: 'Profile', icon: 'person', iconOutline: 'person-outline', label: 'Profile' },
];

/**
 * Custom tab bar for the main stack. Tapping a tab navigates to that stack screen,
 * so every "tab" change uses the real slide transition.
 */
const MainTabBar = ({ navigation, activeRouteName }) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 5) + 5;

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {TAB_CONFIG.map((tab) => {
        const isFocused = activeRouteName === tab.name;
        const color = isFocused ? colors.tabActive : colors.tabInactive;
        const iconName = isFocused ? tab.icon : tab.iconOutline;

        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              if (!isFocused) {
                navigation.navigate(tab.name);
              }
            }}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={isFocused ? { selected: true } : {}}
          >
            <Ionicons name={iconName} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingTop: 2,
    height: 60,
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MainTabBar;
