import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { getPresetById } from '../constants/drugPresets';
import Button from './Button';

const CONSUMPTION_TYPE_LABELS = {
  // Caffeine types
  espresso: { name: 'Espresso', icon: 'cafe', caffeine_mg: 64 },
  instant_coffee: { name: 'Instant Coffee', icon: 'cafe', caffeine_mg: 30 },
  energy_drink: { name: 'Energy Drink', icon: 'flash', caffeine_mg: 150 },
  soft_drink: { name: 'Soft Drink', icon: 'water', caffeine_mg: 34 },

  // Alcohol types
  beer: { name: 'Beer', icon: 'beer', alcohol_units: 1 },
  wine: { name: 'Wine', icon: 'wine', alcohol_units: 1 },
  liquor: { name: 'Liquor', icon: 'flask', alcohol_units: 1 },
  cocktail: { name: 'Cocktail', icon: 'wine', alcohol_units: 1.5 },
};

const QuickConsumptionInput = ({ habit, value, onChange, unit }) => {
  const consumptionEvents = value || []; // Use value prop directly as controlled component
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedConsumptionType, setSelectedConsumptionType] = useState(null);
  const [tempHour, setTempHour] = useState(10);
  const [tempMinute, setTempMinute] = useState(0);
  const [use24Hour, setUse24Hour] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const hourScrollRef = useRef(null);
  const minuteScrollRef = useRef(null);
  const hourScrollPosition = useRef(10);
  const minuteScrollPosition = useRef(0);

  const resetTimeForm = () => {
    setTempHour(12);
    setTempMinute(0);
  };

  const openTimeModal = (consumptionType) => {
    setSelectedConsumptionType(consumptionType);
    const now = new Date();
    setTempHour(now.getHours());
    setTempMinute(now.getMinutes());
    
    // Scroll to current time when modal opens
    setTimeout(() => {
      if (hourScrollRef.current) {
        hourScrollRef.current.scrollTo({ y: now.getHours() * 50, animated: false });
      }
      if (minuteScrollRef.current) {
        minuteScrollRef.current.scrollTo({ y: now.getMinutes() * 50, animated: false });
      }
    }, 100);
    
    setShowTimeModal(true);
  };

  const handleHourScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const hour = Math.round(y / 50);
    if (hour >= 0 && hour <= 23) {
      hourScrollPosition.current = hour;
    }
  };

  const handleHourScrollEnd = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const hour = Math.round(y / 50);
    if (hour >= 0 && hour <= 23) {
      setTempHour(hour);
      hourScrollPosition.current = hour;
    }
  };

  const handleMinuteScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const minute = Math.round(y / 50);
    if (minute >= 0 && minute <= 59) {
      minuteScrollPosition.current = minute;
    }
  };

  const handleMinuteScrollEnd = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const minute = Math.round(y / 50);
    if (minute >= 0 && minute <= 59) {
      setTempMinute(minute);
      minuteScrollPosition.current = minute;
    }
  };

  const quickAddConsumption = (consumptionType, timeOfDay) => {
    let hour;
    switch (timeOfDay) {
      case 'morning':
        hour = 8; // 8 AM
        break;
      case 'afternoon':
        hour = 14; // 2 PM
        break;
      case 'evening':
        hour = 18; // 6 PM
        break;
      default:
        hour = 12; // Noon
    }

    const consumptionTime = new Date(selectedDate);
    consumptionTime.setHours(hour, 0, 0, 0);

    addConsumptionEvent(consumptionType, consumptionTime);
  };

  const confirmTimeModal = () => {
    const consumptionTime = new Date(selectedDate);
    consumptionTime.setHours(tempHour, tempMinute, 0, 0);

    addConsumptionEvent(selectedConsumptionType, consumptionTime);
    setShowTimeModal(false);
  };

  const addConsumptionEvent = (consumptionType, consumptionTime) => {
    const typeInfo = CONSUMPTION_TYPE_LABELS[consumptionType];
    if (!typeInfo) return;

    let amount = 1; // Default amount
    let drinkType = consumptionType;

    // For caffeine, use mg amount
    if (habit.name.toLowerCase().includes('caffeine') && typeInfo.caffeine_mg) {
      amount = typeInfo.caffeine_mg;
    }
    // For alcohol, use drink units
    else if (habit.name.toLowerCase().includes('alcohol') && typeInfo.alcohol_units) {
      amount = typeInfo.alcohol_units;
    }

    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      consumed_at: consumptionTime.toISOString(),
      amount: amount,
      drink_type: drinkType,
    };

    onChange([...consumptionEvents, newEvent]);
  };

  const deleteConsumptionEvent = (eventId) => {
    onChange(consumptionEvents.filter(event => event.id !== eventId));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConsumptionTypeIcon = (type) => {
    return CONSUMPTION_TYPE_LABELS[type]?.icon || 'help-circle';
  };

  const getConsumptionTypeName = (type) => {
    return CONSUMPTION_TYPE_LABELS[type]?.name || type;
  };


  return (
    <View style={styles.container}>
      {/* Habit Name Heading */}
      <Text style={styles.habitHeading}>{habit.name}</Text>

      {/* Quick Consumption Buttons - compact horizontal layout */}
      <View style={styles.quickButtonsContainer}>
        {habit.consumption_types?.slice(0, 4).map((consumptionType) => (
          <TouchableOpacity
            key={consumptionType}
            style={styles.quickButton}
            onPress={() => openTimeModal(consumptionType)}
          >
            <Ionicons name={getConsumptionTypeIcon(consumptionType)} size={14} color={colors.primary} />
            <Text style={styles.quickButtonText} numberOfLines={1}>
              {getConsumptionTypeName(consumptionType).split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openTimeModal(habit.consumption_types?.[0] || 'espresso')}
        >
          <Text style={styles.moreButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Consumption count indicator */}
      {consumptionEvents.length > 0 && (
        <Text style={styles.consumptionCount}>
          {consumptionEvents.length} logged today
        </Text>
      )}

      {/* Time Selection Modal */}
      <Modal
        visible={showTimeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerModal}>
            <Text style={styles.modalTitle}>
              When did you consume {selectedConsumptionType ? getConsumptionTypeName(selectedConsumptionType).toLowerCase() : ''}?
            </Text>

            <View style={styles.timePickerContainer}>
              {/* Hour Picker */}
              <View style={styles.pickerGroup}>
                <Text style={styles.timeLabel}>Hour</Text>
                <View style={styles.pickerWrapper}>
                  <View style={styles.pickerSelection} />
                  <ScrollView
                    ref={hourScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={50}
                    decelerationRate="normal"
                    onScroll={handleHourScroll}
                    onMomentumScrollEnd={handleHourScrollEnd}
                    onScrollEndDrag={handleHourScrollEnd}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const isSelected = tempHour === i;
                      return (
                        <View key={i} style={styles.pickerItem}>
                          <Text style={[
                            styles.pickerItemText,
                            isSelected && styles.pickerItemTextSelected
                          ]}>
                            {i.toString().padStart(2, '0')}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Minute Picker */}
              <View style={styles.pickerGroup}>
                <Text style={styles.timeLabel}>Minute</Text>
                <View style={styles.pickerWrapper}>
                  <View style={styles.pickerSelection} />
                  <ScrollView
                    ref={minuteScrollRef}
                    style={styles.pickerScroll}
                    contentContainerStyle={styles.pickerContent}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={50}
                    decelerationRate="normal"
                    onScroll={handleMinuteScroll}
                    onMomentumScrollEnd={handleMinuteScrollEnd}
                    onScrollEndDrag={handleMinuteScrollEnd}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <View key={i} style={styles.pickerItem}>
                        <Text style={[
                          styles.pickerItemText,
                          tempMinute === i && styles.pickerItemTextSelected
                        ]}>
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={styles.quickTimeOptions}>
              <Text style={styles.quickTimeLabel}>Quick Time:</Text>
              <View style={styles.quickTimeButtons}>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const morning = new Date(selectedDate);
                    morning.setHours(10, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, morning);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Morning</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const afternoon = new Date(selectedDate);
                    afternoon.setHours(15, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, afternoon);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Afternoon</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickTimeButton}
                  onPress={() => {
                    const evening = new Date(selectedDate);
                    evening.setHours(19, 0, 0, 0);
                    addConsumptionEvent(selectedConsumptionType, evening);
                    setShowTimeModal(false);
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>Evening</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowTimeModal(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Add"
                onPress={confirmTimeModal}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  habitHeading: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  quickButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 60,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  moreButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  moreButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  consumptionCount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: spacing.regular,
    width: '90%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.regular,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.regular,
    paddingHorizontal: spacing.md,
  },
  pickerGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  timeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  pickerWrapper: {
    height: 200,
    width: '100%',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickerSelection: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 50,
    marginTop: -25,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.primary,
    zIndex: 1,
  },
  pickerScroll: {
    flex: 1,
    height: 200,
  },
  pickerContent: {
    paddingVertical: 100, // Extra padding to allow scrolling to all items
  },
  pickerItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: typography.sizes.large,
    color: colors.textSecondary,
  },
  pickerItemTextSelected: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  quickTimeOptions: {
    marginBottom: spacing.regular,
  },
  quickTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quickTimeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickTimeButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTimeButtonText: {
    fontSize: typography.sizes.body,
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default QuickConsumptionInput;
