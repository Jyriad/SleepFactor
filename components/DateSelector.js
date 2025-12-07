import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getDatesArray } from '../utils/dateHelpers';

const DateSelector = ({ selectedDate, onDateChange, minDate = null, maxDate = null }) => {
  const scrollViewRef = useRef(null);
  const dates = getDatesArray(selectedDate, 7);

  useEffect(() => {
    // Scroll to selected date
    if (scrollViewRef.current) {
      const selectedIndex = dates.findIndex(d => d.date === selectedDate);
      if (selectedIndex >= 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: selectedIndex * 70,
            animated: true,
          });
        }, 100);
      }
    }
  }, [selectedDate]);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {dates.map((dateItem) => {
        const isSelected = dateItem.date === selectedDate;
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    marginVertical: spacing.md,
  },
  container: {
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
  },
  dateButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDateButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  dayNumber: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  selectedText: {
    color: '#FFFFFF',
  },
});

export default DateSelector;

