import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import HabitToggle from './HabitToggle';
import DrugHabitInput from './DrugHabitInput';
import QuickConsumptionInput from './QuickConsumptionInput';

/** Parse stored "HH:MM" (24h) to Date on selected calendar day (local). */
function timeStringToDate(timeStr, selectedDate) {
  const base =
    selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
      ? new Date(selectedDate)
      : new Date();
  base.setHours(12, 0, 0, 0);
  if (!timeStr || typeof timeStr !== 'string') return base;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return base;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return base;
  const d = new Date(base);
  d.setHours(h, min, 0, 0);
  return d;
}

function dateToStoredTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeForDisplay(time24) {
  if (!time24 || typeof time24 !== 'string') return '';
  const d = timeStringToDate(time24, new Date());
  try {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return time24;
  }
}

function TimeHabitInput({ value, onChange, selectedDate }) {
  const [show, setShow] = useState(false);
  const [pickerDate, setPickerDate] = useState(() =>
    timeStringToDate(value, selectedDate)
  );

  useEffect(() => {
    setPickerDate(timeStringToDate(value, selectedDate));
  }, [value, selectedDate]);

  const open = () => {
    setPickerDate(timeStringToDate(value, selectedDate));
    setShow(true);
  };

  const onAndroidChange = (event, date) => {
    setShow(false);
    if (event.type !== 'set' || !date) return;
    onChange(dateToStoredTime(date));
  };

  const onIosChange = (_, date) => {
    if (date) setPickerDate(date);
  };

  const confirmIos = () => {
    onChange(dateToStoredTime(pickerDate));
    setShow(false);
  };

  const clearTime = () => {
    onChange('');
    setShow(false);
  };

  const displayLabel = value ? formatTimeForDisplay(value) : '';

  return (
    <View style={styles.timeWrap}>
      <TouchableOpacity
        style={styles.timeRow}
        onPress={open}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={value ? `Time ${displayLabel}, tap to change` : 'Tap to set time'}
      >
        <Text
          style={[styles.timeRowText, !value && styles.timePlaceholder]}
          numberOfLines={1}
        >
          {value ? displayLabel : 'Tap to set time'}
        </Text>
        <Ionicons name="time-outline" size={22} color={colors.primary} />
      </TouchableOpacity>
      {!!value && (
        <TouchableOpacity onPress={clearTime} style={styles.timeClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.timeClearText}>Clear</Text>
        </TouchableOpacity>
      )}

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <Pressable style={styles.timeModalOverlay} onPress={() => setShow(false)}>
            <Pressable style={styles.timeModalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.timeModalHeader}>
                <TouchableOpacity onPress={() => setShow(false)} style={styles.timeModalBtn}>
                  <Text style={styles.timeModalBtnText}>Cancel</Text>
                </TouchableOpacity>
                {!!value && (
                  <TouchableOpacity onPress={clearTime} style={styles.timeModalBtn}>
                    <Text style={[styles.timeModalBtnText, styles.timeModalClear]}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={confirmIos} style={styles.timeModalBtn}>
                  <Text style={[styles.timeModalBtnText, styles.timeModalDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="spinner"
                onChange={onIosChange}
                style={styles.timeIosPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const HabitInput = ({ habit, value, onChange, onHabitChange, unit, selectedDate, userId, onConsumptionAdded, onOpenLogConsumption, yesNoCounts, hideQuickConsumptionLoggedList = false }) => {
  const effectiveOnChange = onHabitChange != null
    ? useCallback((v) => onHabitChange(habit.id, v), [onHabitChange, habit.id])
    : onChange;

  const renderInput = () => {
    switch (habit.type) {
      case 'binary': {
        let boolValue = null;
        const v = value != null ? String(value).toLowerCase() : '';
        if (v === 'yes' || value === true) {
          boolValue = true;
        } else if (v === 'no' || value === false) {
          boolValue = false;
        }

        return (
          <HabitToggle
            value={boolValue}
            onChange={(newBoolValue) => {
              if (newBoolValue === null) {
                effectiveOnChange('');
              } else {
                effectiveOnChange(newBoolValue ? 'yes' : 'no');
              }
            }}
            yesCount={yesNoCounts?.yes ?? 0}
            noCount={yesNoCounts?.no ?? 0}
          />
        );
      }

      case 'numeric':
        return (
          <View style={styles.numericContainer}>
            <TextInput
              style={styles.numericInput}
              value={value ? String(value) : ''}
              onChangeText={(text) => {
                const numValue = text === '' ? '' : parseFloat(text);
                effectiveOnChange(String(numValue || ''));
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textLight}
            />
            {unit && (
              <Text style={styles.unit}>{unit}</Text>
            )}
          </View>
        );

      case 'time':
        return (
          <TimeHabitInput
            value={value || ''}
            onChange={effectiveOnChange}
            selectedDate={selectedDate}
          />
        );

      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={effectiveOnChange}
            placeholder="Enter text"
            placeholderTextColor={colors.textLight}
            multiline
          />
        );

      case 'drug':
        return (
          <DrugHabitInput
            habit={habit}
            value={value}
            onChange={effectiveOnChange}
            unit={unit}
          />
        );

      case 'quick_consumption':
        return (
          <QuickConsumptionInput
            habit={habit}
            value={value}
            onChange={effectiveOnChange}
            unit={unit}
            selectedDate={selectedDate}
            userId={userId}
            onConsumptionAdded={onConsumptionAdded}
            onOpenLogConsumption={onOpenLogConsumption}
            hideLoggedList={hideQuickConsumptionLoggedList}
          />
        );

      default:
        return null;
    }
  };

  return <View>{renderInput()}</View>;
};

const styles = StyleSheet.create({
  numericContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numericInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    minWidth: 80,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    minHeight: 44,
  },
  timeWrap: {
    minWidth: 140,
    alignItems: 'flex-end',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.regular,
    backgroundColor: colors.background,
    minHeight: 44,
    maxWidth: 220,
  },
  timeRowText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  timePlaceholder: {
    color: colors.textLight,
    fontWeight: typography.weights.regular,
  },
  timeClear: {
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  timeClearText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  timeModalSheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.regular,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeModalBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  timeModalBtnText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  timeModalClear: {
    color: colors.error,
  },
  timeModalDone: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  timeIosPicker: {
    height: 216,
    width: '100%',
  },
  unit: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
});

export default HabitInput;
