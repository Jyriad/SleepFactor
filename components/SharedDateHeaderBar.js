import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants';
import DateHeader from './DateHeader';
import { useDateHeader } from '../contexts/DateHeaderContext';

const HEADER_INNER_PADDING = 12;

/**
 * Single shared instance of the blue date-picker header.
 * Renders above the Home stack so it stays mounted when switching between Home and HabitLogging.
 */
const SharedDateHeaderBar = () => {
  const ctx = useDateHeader();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const statusBarHeight = Constants.statusBarHeight ?? 24;
  const topPadding = insets.top > 0 ? statusBarHeight : 0;

  const isHabitLogging = route.name === 'HabitLogging';

  if (!ctx) return null;

  const backButton = isHabitLogging ? (
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
      <Ionicons name="chevron-back" size={24} color={colors.white} />
    </TouchableOpacity>
  ) : null;

  return (
    <View style={styles.roundedWrapper}>
      <View style={[styles.headerBlock, { paddingTop: topPadding }]}>
        <View style={styles.headerInner}>
          <DateHeader
            selectedDate={ctx.selectedDate}
            onDateChange={ctx.setSelectedDate}
            datesWithUnsavedChanges={ctx.datesWithUnsavedChanges}
            leftElement={backButton}
          />
        </View>
      </View>
    </View>
  );
};

const HEADER_RADIUS = 12;

const styles = StyleSheet.create({
  roundedWrapper: {
    backgroundColor: colors.primaryDark,
    borderRadius: HEADER_RADIUS,
    overflow: 'hidden',
    elevation: 4,
    zIndex: 1,
  },
  headerBlock: {
    backgroundColor: 'transparent',
    borderRadius: HEADER_RADIUS,
  },
  headerInner: {
    paddingTop: HEADER_INNER_PADDING,
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: spacing.xs,
  },
});

export default SharedDateHeaderBar;
