import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useDateHeader } from '../contexts/DateHeaderContext';
import { colors } from '../constants/colors';
import { formatDateForDB } from '../utils/dateHelpers';
import DatePickerCalendar from './DatePickerCalendar';

const HANDLE_HEIGHT = 14;
const CALENDAR_HEADER_HEIGHT = 28;
const CALENDAR_DAY_NAMES_HEIGHT = 16;
const CALENDAR_ROW_HEIGHT = 36 + 6 * 2;
const CALENDAR_MAX_ROWS = 6;
const SHEET_OPEN_HEIGHT =
  CALENDAR_HEADER_HEIGHT +
  CALENDAR_DAY_NAMES_HEIGHT +
  CALENDAR_MAX_ROWS * CALENDAR_ROW_HEIGHT +
  HANDLE_HEIGHT +
  80;

function SheetHandle() {
  return (
    <View style={handleStyles.wrap}>
      <View style={handleStyles.bar} />
    </View>
  );
}

const handleStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    minHeight: HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    paddingBottom: 2,
  },
  bar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
});

export default function DatePickerBottomSheet() {
  const ctx = useDateHeader();
  const [currentMonth, setCurrentMonth] = useState(() =>
    ctx?.selectedDate ? new Date(ctx.selectedDate) : new Date()
  );

  useEffect(() => {
    if (ctx?.selectedDate) {
      setCurrentMonth(new Date(ctx.selectedDate));
    }
  }, [ctx?.selectedDate]);

  const snapPoints = useMemo(() => [1, SHEET_OPEN_HEIGHT], []);

  const handleSheetChange = useCallback(
    (index) => {
      ctx?.setHeaderExpanded(index > 0);
    },
    [ctx]
  );

  const handleDateSelect = useCallback(
    (dateStr) => {
      if (!ctx) return;
      ctx.setSelectedDate(new Date(dateStr + 'T12:00:00'));
      ctx.closeDatePickerSheet();
    },
    [ctx]
  );

  if (!ctx) return null;

  const selectedDateStr =
    typeof ctx.selectedDate === 'string'
      ? ctx.selectedDate
      : formatDateForDB(ctx.selectedDate);

  return (
    <BottomSheet
      ref={ctx.bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      handleComponent={SheetHandle}
      backgroundStyle={styles.background}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={styles.content}>
        <DatePickerCalendar
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          selectedDateStr={selectedDateStr}
          onDateSelect={handleDateSelect}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.primaryDark,
  },
  content: {
    flex: 1,
  },
});
