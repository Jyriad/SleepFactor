import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants';
import DateHeader from './DateHeader';
import { useDateHeader } from '../contexts/DateHeaderContext';

const HEADER_INNER_PADDING = 12;
const HEADER_BOTTOM_RADIUS = 12;

/**
 * Fixed date-picker header (top row + 7-day strip + handle).
 * Tapping the handle opens the calendar in a bottom sheet (via context).
 */
const ScrollableDateHeaderBar = () => {
  const ctx = useDateHeader();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const statusBarHeight = Constants.statusBarHeight ?? 24;
  const topPadding = insets.top > 0 ? statusBarHeight : 0;

  const isHabitLogging = route.name === 'HabitLogging';

  if (!ctx) return null;

  const handleExpandChange = (expanded) => {
    ctx.setHeaderExpanded(expanded);
  };

  const backButton = isHabitLogging ? (
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
      <Ionicons name="chevron-back" size={24} color={colors.white} />
    </TouchableOpacity>
  ) : null;

  return (
    <View style={[styles.headerBlock, { paddingTop: topPadding }]}>
      <View style={styles.headerInner}>
        <DateHeader
          selectedDate={ctx.selectedDate}
          onDateChange={ctx.setSelectedDate}
          loggedDates={ctx.loggedDates}
          datesWithUnsavedChanges={ctx.datesWithUnsavedChanges}
          leftElement={backButton}
          showTodayButton={!isHabitLogging}
          onExpandChange={handleExpandChange}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBlock: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
    borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    zIndex: 10,
    elevation: 10,
  },
  headerInner: {
    paddingTop: HEADER_INNER_PADDING,
  },
  backButton: {
    padding: spacing.xs,
  },
});

export default ScrollableDateHeaderBar;
