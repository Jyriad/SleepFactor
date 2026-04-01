import React, { useCallback, useContext, useRef, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
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
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateForDB } from '../utils/dateHelpers';

const TAB_ICONS = {
  Home: { focused: 'home', outline: 'home-outline' },
  Insights: { focused: 'bar-chart', outline: 'bar-chart-outline' },
  Habits: { focused: 'list', outline: 'list-outline' },
  Profile: { focused: 'person', outline: 'person-outline' },
};

const FAB_SIZE = 50;
/** How far the + button sits above the top of the white bar (smaller = button lower, shorter footer). */
const FAB_PROTRUSION = 10;
/** Curved nav outline — a bit thicker than a hairline */
const NAV_OUTLINE_WIDTH = 2.5;

/**
 * Custom bottom tab bar: four tabs with a centered floating + button (Log).
 * Tap + opens today’s habit logging. Long-press opens quick links (caffeine, alcohol, sleep check-in).
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
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2, 4);

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

  const bottomInset = Math.max(insets.bottom, 0);

  const onBarLayout = useCallback(
    (e) => {
      const h = e.nativeEvent.layout.height;
      if (typeof h === 'number' && h > 0) {
        // Pad scroll areas by the amount of the + button that extends above the white bar.
        setTabBarHeight?.(h + FAB_PROTRUSION);
      }
    },
    [setTabBarHeight]
  );

  return (
    <View
      style={styles.wrapper}
      onLayout={onBarLayout}
    >
      <View style={[styles.barOuter, { paddingBottom: bottomInset }]}>
        <View
          style={[styles.fabWrap, { top: -FAB_PROTRUSION }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.fab}
            onPress={onFabPress}
            onLongPress={onFabLongPress}
            delayLongPress={380}
            activeOpacity={0.85}
            accessibilityLabel="Log habits for today"
            accessibilityHint="Opens today’s habit logging. Long press for more log options."
          >
            <Ionicons name="add" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.barRow}>
          <View style={styles.sideCluster}>{leftRoutes.map((r, i) => renderTab(r, i))}</View>
          <View style={styles.fabSlot} />
          <View style={styles.sideCluster}>{rightRoutes.map((r, i) => renderTab(r, i + 2))}</View>
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
  },
  barOuter: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: NAV_OUTLINE_WIDTH,
    borderLeftWidth: NAV_OUTLINE_WIDTH,
    borderRightWidth: NAV_OUTLINE_WIDTH,
    borderBottomWidth: 0,
    borderColor: colors.primary,
    backgroundColor: colors.background,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: 2,
    paddingBottom: 6,
  },
  sideCluster: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  fabSlot: {
    width: FAB_SIZE + spacing.sm,
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
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
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
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  menuIcon: {
    marginRight: spacing.sm,
  },
});

export default MainTabBar;
