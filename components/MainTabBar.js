import React, { useCallback, useContext } from 'react';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import PressableFeedback from './PressableFeedback';
import { Ionicons } from '@expo/vector-icons';
import TabBarBlurBackground from './TabBarBlurBackground';
import { colors } from '../constants/colors';
import { appFont, spacing } from '../constants';

const TAB_ICONS = {
  Home: { focused: 'home', outline: 'home-outline' },
  Journal: { focused: 'book', outline: 'book-outline' },
  Sleep: { focused: 'moon', outline: 'moon-outline' },
  Insights: { focused: 'analytics', outline: 'analytics-outline' },
};

const TAB_BAR_BLUR_INTENSITY = Platform.OS === 'ios' ? 72 : 48;
const TAB_BAR_FROST_OVERLAY = 'rgba(255, 255, 255, 0.28)';

function MainTabBar({ state, descriptors, navigation, insets }) {
  const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext);

  const renderTab = (route, index) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
          ? options.title
          : route.name;

    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    const color = isFocused ? colors.tabActive : colors.tabInactive;
    const icons = TAB_ICONS[route.name] || TAB_ICONS.Home;
    const iconName = isFocused ? icons.focused : icons.outline;

    return (
      <PressableFeedback
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        haptic="selection"
        style={styles.tabItem}
      >
        <Ionicons name={iconName} size={24} color={color} />
        <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </PressableFeedback>
    );
  };

  const bottomInset = Math.max(insets.bottom, 0);

  const onBarLayout = useCallback(
    (e) => {
      const h = e.nativeEvent.layout.height;
      if (typeof h === 'number' && h > 0) {
        setTabBarHeight?.(h);
      }
    },
    [setTabBarHeight]
  );

  return (
    <View style={styles.wrapper} onLayout={onBarLayout}>
      <View style={styles.barShadowWrap}>
        <View style={[styles.barClip, { paddingBottom: bottomInset }]}>
          <TabBarBlurBackground intensity={TAB_BAR_BLUR_INTENSITY} tint="light" />
          <View
            pointerEvents="none"
            style={[styles.barFrostOverlay, StyleSheet.absoluteFillObject]}
          />
          <View style={styles.barRow}>
            {state.routes.map((route, index) => renderTab(route, index))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    ...Platform.select({
      android: { elevation: 24 },
    }),
  },
  barShadowWrap: {
    width: '100%',
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  barClip: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  barFrostOverlay: {
    backgroundColor: TAB_BAR_FROST_OVERLAY,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: 2,
    paddingBottom: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 56,
    minHeight: 44,
  },
  tabLabel: {
    ...appFont,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default MainTabBar;
