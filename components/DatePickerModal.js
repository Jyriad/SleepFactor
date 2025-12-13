import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { formatDateForDB, getToday } from '../utils/dateHelpers';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

const DatePickerModal = ({ visible, onClose, selectedDate, onDateSelect }) => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Initialize to the month of the selected date
    return selectedDate ? new Date(selectedDate) : new Date();
  });
  const [loggedDates, setLoggedDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && user) {
      fetchLoggedDatesForMonth();
    }
  }, [visible, currentMonth, user]);

  // Update current month when selectedDate changes and modal opens
  useEffect(() => {
    if (visible && selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [visible, selectedDate]);

  const fetchLoggedDatesForMonth = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // Get first and last day of month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startDate = formatDateForDB(firstDay);
      const endDate = formatDateForDB(lastDay);

      const { data, error } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      const loggedDateSet = new Set(data?.map(log => log.date) || []);
      setLoggedDates(Array.from(loggedDateSet));
    } catch (error) {
      console.error('Error fetching logged dates for month:', error);
      setLoggedDates([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        day,
        date: formatDateForDB(date),
        fullDate: date,
      });
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    
    // Prevent navigating beyond the current month
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    const newMonthValue = newMonth.getMonth();
    const newYear = newMonth.getFullYear();
    
    // Only allow navigation if the new month is not in the future
    if (newYear < todayYear || (newYear === todayYear && newMonthValue <= todayMonth)) {
      setCurrentMonth(newMonth);
    }
  };

  const handleDateSelect = (date) => {
    if (date) {
      const today = getToday();
      // Only allow selecting dates that are today or in the past
      if (date <= today) {
        onDateSelect(date);
        onClose();
      }
    }
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const days = getDaysInMonth();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = getToday();
  
  // Check if we can navigate forward (not beyond current month)
  const todayDate = new Date();
  const currentMonthValue = currentMonth.getMonth();
  const currentYear = currentMonth.getFullYear();
  const canNavigateForward = currentYear < todayDate.getFullYear() || 
    (currentYear === todayDate.getFullYear() && currentMonthValue < todayDate.getMonth());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={() => navigateMonth(-1)}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.monthText}>{monthName}</Text>
                <TouchableOpacity
                  onPress={() => navigateMonth(1)}
                  style={styles.navButton}
                  disabled={!canNavigateForward}
                >
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={canNavigateForward ? colors.textPrimary : colors.textLight} 
                  />
                </TouchableOpacity>
              </View>

              {/* Day names */}
              <View style={styles.dayNamesRow}>
                {dayNames.map((dayName) => (
                  <View key={dayName} style={styles.dayNameCell}>
                    <Text style={styles.dayNameText}>{dayName}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.calendarGrid}>
                {days.map((dayItem, index) => {
                  if (!dayItem) {
                    return <View key={`empty-${index}`} style={styles.dateCell} />;
                  }

                  const isSelected = dayItem.date === selectedDate;
                  const isLogged = loggedDates.includes(dayItem.date);
                  const isTodayDate = dayItem.date === today;
                  const isFuture = dayItem.date > today;

                  // Don't render future dates
                  if (isFuture) {
                    return <View key={dayItem.date} style={styles.dateCell} />;
                  }

                  return (
                    <TouchableOpacity
                      key={dayItem.date}
                      style={[
                        styles.dateCell,
                        isLogged && !isSelected && styles.loggedDateCell,
                        isTodayDate && !isSelected && styles.todayCell,
                        isSelected && styles.selectedDateCell,
                      ]}
                      onPress={() => handleDateSelect(dayItem.date)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          isTodayDate && !isSelected && styles.todayText,
                          isSelected && styles.selectedText,
                        ]}
                      >
                        {dayItem.day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 280, // Fixed height to prevent layout shifts (reduced from 320)
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.regular,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthText: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayNameText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 200, // Fixed height to accommodate 6 rows (reduced from 240)
  },
  dateCell: {
    width: '14.28%', // 7 columns
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dateText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  loggedDateCell: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // colors.success with 20% opacity
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  todayText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  selectedDateCell: {
    backgroundColor: colors.primary,
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
});

export default DatePickerModal;

