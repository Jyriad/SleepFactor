import React from 'react';
import { View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { spacing } from '../constants';
import DateHeader from './DateHeader';

const HEADER_INNER_PADDING = 12;

/**
 * Shared layout for screens that show the blue date-picker header.
 * Same wrapper tree, padding logic, and blue strip with rounded corners on every screen.
 * Use this so the header looks identical and doesn't snap when navigating.
 */
const DateHeaderLayout = ({
  selectedDate,
  onDateChange,
  leftElement = null,
  showTodayButton = true,
  loggedDates = [],
  datesWithUnsavedChanges = [],
  children,
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Constants.statusBarHeight ?? 24;
  const topPadding = insets.top > 0 ? statusBarHeight : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.contentColumn}>
        <View style={[styles.headerBlock, { paddingTop: topPadding }]}>
          <View style={styles.headerInner}>
            <DateHeader
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              loggedDates={loggedDates}
              datesWithUnsavedChanges={datesWithUnsavedChanges}
              leftElement={leftElement}
              showTodayButton={showTodayButton}
            />
          </View>
        </View>
        <View style={[styles.body, { paddingBottom: insets.bottom }]}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentColumn: {
    flex: 1,
  },
  headerBlock: {
    backgroundColor: colors.primaryDark,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  headerInner: {
    paddingTop: HEADER_INNER_PADDING,
  },
  body: {
    flex: 1,
  },
});

export default DateHeaderLayout;
