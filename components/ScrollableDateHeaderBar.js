import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants';
import DateHeader from './DateHeader';
import { useDateHeader } from '../contexts/DateHeaderContext';

const HEADER_BOTTOM_RADIUS = 12;

/**
 * Fixed date-picker header (top row + 7-day strip + handle).
 * Tapping the handle opens the calendar in a bottom sheet (via context).
 * When showBackButton is true (e.g. Habit Logging in pre-mounted overlay), back is shown and onBackPress is used if provided.
 */
const ScrollableDateHeaderBar = ({ rightElement = null, showBackButton: showBackButtonProp = false, onBackPress = null }) => {
  const ctx = useDateHeader();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  // Use safe-area inset only (not expo statusBarHeight) so iOS isn’t over-padded vs the notch.
  const topPadding = insets.top;

  const isHabitLogging = showBackButtonProp || route.name === 'HabitLogging';
  const handleBack = onBackPress ?? (() => navigation.goBack());

  if (!ctx) return null;

  const handleExpandChange = (expanded) => {
    ctx.setHeaderExpanded(expanded);
  };

  const backButton = isHabitLogging ? (
    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
          rightElement={rightElement}
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
    marginBottom: 0,
    zIndex: 10,
    elevation: 10,
  },
  headerInner: {
    paddingTop: 0,
  },
  backButton: {
    padding: spacing.xs,
  },
});

export default ScrollableDateHeaderBar;
