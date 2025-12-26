import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getDatesArray, formatDateForDB } from '../utils/dateHelpers';

const DateSelector = ({ selectedDate, onDateChange, loggedDates = [], datesWithUnsavedChanges = [] }) => {
  const dates = getDatesArray();

  return (
    <View style={styles.container}>
      {dates.map((dateItem) => {
        const isSelected = dateItem.date === (typeof selectedDate === 'string' ? selectedDate : formatDateForDB(selectedDate));
        const isLogged = loggedDates.includes(dateItem.date);
        const hasUnsavedChanges = datesWithUnsavedChanges.includes(dateItem.date);
        return (
          <TouchableOpacity
            key={dateItem.date}
            style={[
              styles.dateButton,
              isSelected && styles.selectedDateButton,
            ]}
            onPress={() => onDateChange(dateItem.date)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.dayName,
              isSelected && styles.selectedText,
            ]}>
              {dateItem.dayName}
            </Text>
            <Text style={[
              styles.dayNumber,
              isSelected && styles.selectedText,
            ]}>
              {dateItem.dayNumber}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.regular,
    marginVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButton: {
    width: 60,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  loggedDateButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // colors.success with 20% opacity
  },
  unsavedDateButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber/orange color for unsaved changes
  },
  selectedDateButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  dayNumber: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  selectedText: {
    color: '#FFFFFF',
  },
});

export default DateSelector;

