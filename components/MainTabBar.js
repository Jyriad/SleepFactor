import React, { useCallback, useContext, useRef, useState } from 'react';
import { CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBarBlurBackground from './TabBarBlurBackground';
import { colors } from '../constants/colors';
import { typography, spacing, appFont } from '../constants';
import { formatDateForDB } from '../utils/dateHelpers';

const TAB_ICONS = {
  Home: { focused: 'home', outline: 'home-outline' },
  Insights: { focused: 'bar-chart', outline: 'bar-chart-outline' },
  Habits: { focused: 'list', outline: 'list-outline' },
  Profile: { focused: 'person', outline: 'person-outline' },
};

/** Native blur strength (iOS full-range; Android scaled via blurReductionFactor) */
const TAB_BAR_BLUR_INTENSITY = Platform.OS === 'ios' ? 72 : 48;
/** Light veil on top of blur — keep low so glass effect stays visible */
const TAB_BAR_FROST_OVERLAY = 'rgba(255, 255, 255, 0.28)';
/**
 * Custom bottom tab bar: five slots — Home, Insights, Log, Habits, Profile.
 * Log opens today’s habit logging; long-press opens quick links (caffeine, alcohol, sleep check-in).
 */
const MENU_NAV_DELAY_MS = 120;
/** After closing the modal, ignore + taps briefly so the same touch doesn’t open habit logging. */
const SUPPRESS_FAB_MS = 700;

function MainTabBar({ state, descriptors, navigation, insets }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext);
  const ignoreFabPressUntilRef = useRef(0);

  const todayStr = formatDateForDB(new Date());

  const goToHabitLogging = useCallback(
    (extra = {}) => {
      navigation.navigate('Home', {
        screen: 'HabitLogging',
        params: {
          date: todayStr,
          ...extra,
        },
        merge: true,
      });
    },
    [navigation, todayStr]
  );

  const onFabPress = useCallback(() => {
    if (Date.now() < ignoreFabPressUntilRef.current) return;
    goToHabitLogging();
  }, [goToHabitLogging]);

  const onFabLongPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const onMenuSleepQuality = useCallback(() => {
    ignoreFabPressUntilRef.current = Date.now() + SUPPRESS_FAB_MS;
    closeMenu();
    setTimeout(() => {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Home',
          params: {
            screen: 'SleepQualityLog',
            params: { date: todayStr },
          },
        })
      );
    }, MENU_NAV_DELAY_MS);
  }, [closeMenu, navigation, todayStr]);

  const onMenuCaffeine = useCallback(() => {
    ignoreFabPressUntilRef.current = Date.now() + SUPPRESS_FAB_MS;
    closeMenu();
    setTimeout(() => {
      goToHabitLogging({
        pendingQuickLog: 'caffeine',
        pendingActionToken: `${Date.now()}-caffeine`,
      });
    }, MENU_NAV_DELAY_MS);
  }, [closeMenu, goToHabitLogging]);

  const onMenuAlcohol = useCallback(() => {
    ignoreFabPressUntilRef.current = Date.now() + SUPPRESS_FAB_MS;
    closeMenu();
    setTimeout(() => {
      goToHabitLogging({
        pendingQuickLog: 'alcohol',
        pendingActionToken: `${Date.now()}-alcohol`,
      });
    }, MENU_NAV_DELAY_MS);
  }, [closeMenu, goToHabitLogging]);

  const routes = state.routes;
  const homeRoute = routes.find((r) => r.name === 'Home');
  const homeTabIndex = routes.findIndex((r) => r.name === 'Home');
  const focusedInHomeStack = homeRoute
    ? getFocusedRouteNameFromRoute(homeRoute)
    : undefined;
  const isLogFocused =
    homeTabIndex >= 0 &&
    state.index === homeTabIndex &&
    focusedInHomeStack === 'HabitLogging';

  const renderTab = (route, indexInFullList) => {
    const { options } = descriptors[route.key];
    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
          ? options.title
          : route.name;

    const isFocused = state.index === indexInFullList;

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
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabItem}
        activeOpacity={0.7}
      >
        <Ionicons name={iconName} size={24} color={color} />
        <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const logColor = isLogFocused ? colors.tabActive : colors.tabInactive;
  const logIconName = isLogFocused ? 'add' : 'add-outline';

  const renderLogTab = () => (
    <TouchableOpacity
      key="log-tab"
      accessibilityRole="button"
      accessibilityState={isLogFocused ? { selected: true } : {}}
      accessibilityLabel="Log habits for today"
      accessibilityHint="Opens today’s habit logging. Long press for more log options."
      onPress={onFabPress}
      onLongPress={onFabLongPress}
      delayLongPress={380}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Ionicons name={logIconName} size={24} color={logColor} />
      <Text style={[styles.tabLabel, { color: logColor }]} numberOfLines={1}>
        Log
      </Text>
    </TouchableOpacity>
  );

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
    <View
      style={styles.wrapper}
      onLayout={onBarLayout}
    >
      <View style={styles.barShadowWrap}>
        <View style={[styles.barClip, { paddingBottom: bottomInset }]}>
          <TabBarBlurBackground
            intensity={TAB_BAR_BLUR_INTENSITY}
            tint="light"
            experimentalBlurMethod={
              Platform.OS === 'android' ? 'dimezisBlurView' : undefined
            }
            blurReductionFactor={Platform.OS === 'android' ? 5 : undefined}
          />
          <View
            pointerEvents="none"
            style={[styles.barFrostOverlay, StyleSheet.absoluteFillObject]}
          />
          <View style={styles.barRow}>
            {renderTab(routes[0], 0)}
            {renderTab(routes[1], 1)}
            {renderLogTab()}
            {renderTab(routes[2], 2)}
            {renderTab(routes[3], 3)}
          </View>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <View style={styles.menuAnchor}>
            <Pressable onPress={(e) => e.stopPropagation()} style={styles.menuCard}>
              <Text style={styles.menuTitle}>Quick log</Text>
              <TouchableOpacity style={[styles.menuRow, styles.menuRowFirst]} onPress={onMenuCaffeine} activeOpacity={0.7}>
                <Ionicons name="cafe-outline" size={22} color={colors.primary} style={styles.menuIcon} />
                <Text style={styles.menuRowText}>Caffeine</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuRow} onPress={onMenuAlcohol} activeOpacity={0.7}>
                <Ionicons name="wine-outline" size={22} color={colors.primary} style={styles.menuIcon} />
                <Text style={styles.menuRowText}>Alcohol</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuRow} onPress={onMenuSleepQuality} activeOpacity={0.7}>
                <Ionicons name="moon-outline" size={22} color={colors.primary} style={styles.menuIcon} />
                <Text style={styles.menuRowText}>How did you sleep?</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: 'transparent',
    // Overlay the screen so BlurView has content behind it (not an empty strip / solid fill).
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuAnchor: {
    paddingBottom: 120,
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
  },
  menuCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTitle: {
    ...appFont,
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuRowFirst: {
    borderTopWidth: 0,
  },
  menuRowText: {
    ...appFont,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuIcon: {
    marginRight: spacing.sm,
  },
});

export default MainTabBar;
