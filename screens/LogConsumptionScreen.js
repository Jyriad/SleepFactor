import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { getDefaultVolumeForOptionInRegion } from '../constants/consumptionReferenceData';
import consumptionOptionsService from '../services/consumptionOptionsService';
import { supabase } from '../services/supabase';
import sleepDataService from '../services/sleepDataService';
import { getBedtimeDrugLevel, habitUsesCaffeineMgFloor, CAFFEINE_MG_FLOOR } from '../utils/drugHalfLife';
import { formatVolume, getVolumeUnitLabel, parseVolumeInputToMl, mlToUserUnit } from '../utils/unitConversion';

const LogConsumptionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { preferences } = useUserPreferences();
  const measurementRegion = preferences.measurementRegion || 'metric';
  const measurementSystem = preferences.measurementSystem || 'metric';

  const { habit, selectedOption: initialOption, selectedDate, userId, editingEvent, onSaveSuccess } = route.params || {};

  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate ?? Date.now());

  const [consumptionOptions, setConsumptionOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(!!habit?.id);
  const [selectedOption, setSelectedOption] = useState(initialOption ?? null);
  const [selectedServing, setSelectedServing] = useState(1);
  const [showCustomVolume, setShowCustomVolume] = useState(false);
  const [customVolume, setCustomVolume] = useState('');
  const [customDrugAmount, setCustomDrugAmount] = useState(0);
  const [selectedTime, setSelectedTime] = useState(() => {
    const day = new Date(selectedDateObj);
    if (editingEvent?.consumed_at) {
      const t = new Date(editingEvent.consumed_at);
      day.setHours(t.getHours(), t.getMinutes(), 0, 0);
    } else {
      const now = new Date();
      day.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    return day;
  });
  const [androidTimePickerVisible, setAndroidTimePickerVisible] = useState(false);
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const customVolumeRef = useRef('');
  const [customAmountDisplayValue, setCustomAmountDisplayValue] = useState(selectedOption?.drug_amount ?? customDrugAmount ?? 0);

  useEffect(() => {
    setCustomAmountDisplayValue(selectedOption?.drug_amount ?? customDrugAmount ?? 0);
  }, [selectedOption?.drug_amount, customDrugAmount]);

  // Prefill form when editing an existing event
  useEffect(() => {
    if (!editingEvent || !selectedOption) return;
    const resolvedOption = selectedOption;
    const volumeMl = editingEvent.volume != null ? Number(editingEvent.volume) : null;
    const effectiveDefaultVol = getDefaultVolumeForOptionInRegion(resolvedOption.name, habit?.name, measurementRegion) ?? resolvedOption.default_volume ?? null;

    let useCustom = editingEvent.serving === 'custom';
    let presetServing = editingEvent.serving && editingEvent.serving !== 'custom' ? editingEvent.serving : 1;

    if (volumeMl != null && volumeMl > 0 && effectiveDefaultVol) {
      const tolerance = 2;
      let matched = false;
      for (let n = 1; n <= 10; n++) {
        const expected = effectiveDefaultVol * n;
        if (Math.abs(volumeMl - expected) <= tolerance) {
          presetServing = n;
          matched = true;
          break;
        }
      }
      if (!matched) useCustom = true;
    } else if (volumeMl != null && volumeMl > 0) {
      useCustom = true;
    }

    if (useCustom) {
      setSelectedServing('custom');
      setShowCustomVolume(true);
      setCustomDrugAmount(editingEvent.amount ?? 0);
      setCustomAmountDisplayValue(editingEvent.amount ?? 0);
      const vol = volumeMl ?? (editingEvent.base_amount && resolvedOption?.default_volume
        ? (editingEvent.amount / editingEvent.base_amount) * resolvedOption.default_volume
        : null);
      const volumeStr = vol ? mlToUserUnit(vol, measurementSystem) : '100';
      setCustomVolume(volumeStr);
      customVolumeRef.current = volumeStr;
    } else {
      setSelectedServing(presetServing);
      setShowCustomVolume(false);
      setCustomVolume('');
      setCustomDrugAmount(0);
    }
  }, [editingEvent?.id]); // Run once when editingEvent is set

  useEffect(() => {
    if (!habit?.id) {
      setLoadingOptions(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const result = await consumptionOptionsService.getOptionsForHabit(habit.id, measurementRegion);
        if (cancelled) return;
        if (result.success) setConsumptionOptions(result.data || []);
      } catch (e) {
        if (!cancelled) setConsumptionOptions([]);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [habit?.id, measurementRegion]);

  const getEffectiveDefaultVolume = useCallback((option) => {
    if (!option) return null;
    const regionVol = getDefaultVolumeForOptionInRegion(option.name, habit?.name, measurementRegion);
    return regionVol ?? option.default_volume ?? null;
  }, [habit?.name, measurementRegion]);

  const calculateCustomDrugAmount = useCallback((volumeMl) => {
    if (!selectedOption || !selectedOption.drug_amount) return 0;
    if (volumeMl == null || volumeMl <= 0) return 0;
    const refVolume = getEffectiveDefaultVolume(selectedOption) ?? selectedOption?.default_volume;
    if (refVolume) {
      const calculated = (volumeMl / refVolume) * selectedOption.drug_amount;
      return Math.round(calculated * 10) / 10;
    }
    return Math.round(volumeMl * 10) / 10;
  }, [selectedOption, getEffectiveDefaultVolume]);

  const effectiveDefaultVolForDisplay = useMemo(
    () => (selectedOption ? getEffectiveDefaultVolume(selectedOption) : null),
    [selectedOption?.id, selectedOption?.name, habit?.name, measurementRegion, getEffectiveDefaultVolume]
  );
  const customVolumePlaceholder = useMemo(
    () => (effectiveDefaultVolForDisplay ? mlToUserUnit(effectiveDefaultVolForDisplay, measurementSystem) : '100'),
    [effectiveDefaultVolForDisplay, measurementSystem]
  );

  const resolveConsumptionType = useCallback((type) => {
    if (!type || !consumptionOptions?.length) return null;
    let option = consumptionOptions.find((opt) => opt.id === type);
    if (option) return option;
    const legacyMappings = {
      espresso: 'Espresso', instant_coffee: 'Instant Coffee', energy_drink: 'Energy Drink',
      soft_drink: 'Soft Drink', beer: 'Beer', wine: 'Wine', liquor: 'Liquor', cocktail: 'Cocktail',
    };
    const mappedName = legacyMappings[type];
    if (mappedName) {
      option = consumptionOptions.find((opt) => opt.name === mappedName);
      if (option) return option;
    }
    return consumptionOptions.find((opt) =>
      opt.name.toLowerCase().replace(/\s+/g, '_') === type
    ) || null;
  }, [consumptionOptions]);

  const updateBedtimeDrugLevel = useCallback(async (habitId, date) => {
    if (!userId) return;
    try {
      const { data: habitRow } = await supabase.from('habits').select('*').eq('id', habitId).single();
      if (!habitRow || habitRow.type !== 'quick_consumption') return;
      const name = (habitRow.name || '').toLowerCase();
      if (!name.includes('caffeine') && !name.includes('alcohol')) return;

      const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
      const [y, mo, day] = dateString.split('-').map(Number);
      const nextDay = new Date(y, mo - 1, day + 1);
      const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
      const sleepData = await sleepDataService.getSleepDataForDate(nextDayStr);

      let targetBedtime;
      if (sleepData?.sleep_start_time) {
        targetBedtime = new Date(sleepData.sleep_start_time);
      } else {
        const { data: userData } = await supabase.from('users').select('notification_time').eq('id', userId).single();
        const notificationTime = userData?.notification_time || '22:00:00';
        targetBedtime = new Date(date);
        const [hours, minutes, seconds] = notificationTime.split(':').map(Number);
        targetBedtime.setHours(hours, minutes, seconds || 0, 0);
      }

      const maxHalfLife = habitRow.half_life_hours || 5;
      const historyDays = Math.max(3, Math.ceil((maxHalfLife * 3) / 24));
      const historyStart = new Date(targetBedtime);
      historyStart.setDate(historyStart.getDate() - historyDays);

      const { data: eventsData, error: eventsError } = await supabase
        .from('habit_consumption_events')
        .select('*')
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .gte('consumed_at', historyStart.toISOString())
        .lte('consumed_at', targetBedtime.toISOString())
        .order('consumed_at', { ascending: true });

      if (eventsError) return;

      const minMg = habitUsesCaffeineMgFloor(habitRow.name) ? CAFFEINE_MG_FLOOR : null;
      const bedtimeLevel = eventsData?.length > 0
        ? getBedtimeDrugLevel(eventsData, targetBedtime, habitRow.half_life_hours || 5, 5, minMg)
        : 0;

      const drugLevelEntry = {
        user_id: userId,
        habit_id: habitId,
        date: dateString,
        level_value: bedtimeLevel,
        unit: habitRow.unit,
        calculated_at: new Date().toISOString(),
        bedtime_at: targetBedtime.toISOString(),
      };
      await supabase.from('drug_levels').upsert(drugLevelEntry, { onConflict: 'user_id,habit_id,date' });
    } catch (err) {}
  }, [userId]);

  const handleCustomVolumeBlur = useCallback(() => {
    const inputUnit = getVolumeUnitLabel(measurementSystem);
    const volumeMl = parseVolumeInputToMl(customVolumeRef.current, measurementSystem, inputUnit);
    const calculatedAmount = calculateCustomDrugAmount(volumeMl);
    setCustomAmountDisplayValue(calculatedAmount);
  }, [measurementSystem, selectedOption?.id, calculateCustomDrugAmount]);

  const handleCustomVolumeChange = useCallback((text) => {
    customVolumeRef.current = text;
    const inputUnit = getVolumeUnitLabel(measurementSystem);
    const volumeMl = parseVolumeInputToMl(text, measurementSystem, inputUnit);
    const calculatedAmount = calculateCustomDrugAmount(volumeMl);
    setCustomAmountDisplayValue(calculatedAmount);
  }, [measurementSystem, selectedOption?.id, calculateCustomDrugAmount]);

  const formatTimeLabel = useCallback((d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }, []);

  const mergeTimeOntoSelectedDay = useCallback((timeSource) => {
    const merged = new Date(selectedDateObj);
    merged.setHours(timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), 0);
    return merged;
  }, [selectedDateObj]);

  const onNativeTimeChange = useCallback((event, date) => {
    if (Platform.OS === 'android') {
      setAndroidTimePickerVisible(false);
    }
    if (Platform.OS === 'android' && event?.type === 'dismissed') {
      return;
    }
    if (date) {
      setSelectedTime(mergeTimeOntoSelectedDay(date));
    }
  }, [mergeTimeOntoSelectedDay]);

  const getNowOnSelectedDay = useCallback(() => {
    const merged = new Date(selectedDateObj);
    const now = new Date();
    merged.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return merged;
  }, [selectedDateObj]);

  const addConsumptionEvent = useCallback(async (consumptionType, consumptionTime) => {
    if (!habit?.id || !userId) return;
    const resolvedOption = resolveConsumptionType(consumptionType);
    let baseAmount = resolvedOption?.drug_amount ?? (habit?.name?.toLowerCase().includes('caffeine') ? 95 : 1);
    let drinkType = consumptionType;
    let totalAmount = 0;
    let volumeConsumed;
    let servingMultiplier;

    if (selectedServing === 'custom' && selectedOption) {
      const inputUnit = getVolumeUnitLabel(measurementSystem);
      const volumeStr = customVolumeRef.current ?? customVolume;
      volumeConsumed = parseVolumeInputToMl(volumeStr, measurementSystem, inputUnit) || selectedOption?.default_volume || 0;
      totalAmount = calculateCustomDrugAmount(volumeConsumed);
      servingMultiplier = 'custom';
    } else if (selectedOption) {
      servingMultiplier = selectedServing || 1;
      const effectiveDefaultVol = getEffectiveDefaultVolume(selectedOption) ?? resolvedOption?.default_volume;
      const refVolume = effectiveDefaultVol || selectedOption?.default_volume || resolvedOption?.default_volume || 1;
      volumeConsumed = effectiveDefaultVol ? effectiveDefaultVol * servingMultiplier : 0;
      totalAmount = refVolume ? (baseAmount * (volumeConsumed / refVolume)) : baseAmount * servingMultiplier;
    } else {
      totalAmount = parseFloat(quickAddAmount) || baseAmount;
      volumeConsumed = null;
      servingMultiplier = 'custom';
      drinkType = null;
    }

    if (resolvedOption) drinkType = resolvedOption.id;

    const dateObj = selectedDateObj;
    const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
    const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

    await supabase
      .from('habit_consumption_events')
      .delete()
      .eq('user_id', userId)
      .eq('habit_id', habit.id)
      .eq('drink_type', 'none')
      .gte('consumed_at', startOfDay.toISOString())
      .lte('consumed_at', endOfDay.toISOString());

    const { data, error } = await supabase
      .from('habit_consumption_events')
      .insert({
        habit_id: habit.id,
        user_id: userId,
        consumed_at: consumptionTime.toISOString(),
        amount: totalAmount,
        volume: volumeConsumed,
        drink_type: drinkType,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', 'Failed to add consumption');
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    navigation.goBack();
  }, [habit, userId, selectedOption, selectedServing, customVolume, quickAddAmount, measurementSystem, resolveConsumptionType, getEffectiveDefaultVolume, calculateCustomDrugAmount, selectedDateObj, updateBedtimeDrugLevel, onSaveSuccess, navigation]);

  const updateConsumptionEvent = useCallback(async (eventId, consumptionType, consumptionTime) => {
    if (!habit?.id || !userId) return;
    const resolvedOption = resolveConsumptionType(consumptionType);
    let baseAmount = resolvedOption?.drug_amount ?? (habit?.name?.toLowerCase().includes('caffeine') ? 95 : 1);
    let totalAmount = 0;
    let volumeConsumed;
    let servingMultiplier;

    if (selectedServing === 'custom' && selectedOption) {
      const inputUnit = getVolumeUnitLabel(measurementSystem);
      const volumeStr = customVolumeRef.current ?? customVolume;
      volumeConsumed = parseVolumeInputToMl(volumeStr, measurementSystem, inputUnit) || resolvedOption?.default_volume || 0;
      totalAmount = calculateCustomDrugAmount(volumeConsumed);
      servingMultiplier = 'custom';
    } else {
      servingMultiplier = selectedServing || 1;
      const effectiveDefaultVol = resolvedOption ? (getDefaultVolumeForOptionInRegion(resolvedOption.name, habit?.name, measurementRegion) ?? resolvedOption.default_volume) : null;
      const refVolume = effectiveDefaultVol || resolvedOption?.default_volume || 1;
      volumeConsumed = effectiveDefaultVol ? effectiveDefaultVol * servingMultiplier : 0;
      totalAmount = refVolume ? (baseAmount * (volumeConsumed / refVolume)) : baseAmount * servingMultiplier;
    }

    const { error: updateError } = await supabase
      .from('habit_consumption_events')
      .update({
        consumed_at: consumptionTime.toISOString(),
        amount: totalAmount,
        volume: volumeConsumed,
        drink_type: resolvedOption?.id || consumptionType,
      })
      .eq('id', eventId);

    if (updateError) {
      Alert.alert('Error', 'Failed to update consumption');
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    navigation.goBack();
  }, [habit, userId, selectedOption, selectedServing, customVolume, measurementSystem, resolveConsumptionType, calculateCustomDrugAmount, selectedDateObj, updateBedtimeDrugLevel, onSaveSuccess, navigation]);

  const performQuickSave = useCallback(async (consumptionTime) => {
    if (editingEvent) {
      setSaving(true);
      try {
        await updateConsumptionEvent(editingEvent.id, editingEvent.drink_type, consumptionTime);
      } finally {
        setSaving(false);
      }
    } else if (selectedOption) {
      setSaving(true);
      try {
        await addConsumptionEvent(selectedOption.id, consumptionTime);
      } finally {
        setSaving(false);
      }
    } else {
      const amount = parseFloat(quickAddAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
        return;
      }
      setSaving(true);
      try {
        await addConsumptionEvent(null, consumptionTime);
      } finally {
        setSaving(false);
      }
    }
  }, [editingEvent, selectedOption, quickAddAmount, addConsumptionEvent, updateConsumptionEvent]);

  const confirmSave = useCallback(async () => {
    await performQuickSave(mergeTimeOntoSelectedDay(selectedTime));
  }, [performQuickSave, mergeTimeOntoSelectedDay, selectedTime]);

  const getActiveIngredientLabel = () => {
    const name = (habit?.name || '').toLowerCase();
    if (name.includes('caffeine')) return 'caffeine';
    if (name.includes('alcohol')) return 'alcohol';
    return null;
  };


  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(colors.primary);
        if (StatusBar.setTranslucent) StatusBar.setTranslucent(true);
      }
    }, [])
  );

  if (!habit) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log consumption</Text>
        </View>
        <Text style={styles.errorText}>Missing habit.</Text>
      </SafeAreaView>
    );
  }

  const isQuickAdd = !selectedOption && !editingEvent;
  const headerTitleText = editingEvent ? 'Update consumption' : isQuickAdd ? 'Quick add' : 'Log consumption';
  const headerSubtitleText = editingEvent
    ? (selectedOption?.name ?? '')
    : isQuickAdd
      ? (habit?.name ?? '')
      : (selectedOption?.name ?? '');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSideButton} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.headerCancelText}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{headerTitleText}</Text>
          {headerSubtitleText ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{headerSubtitleText}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.headerSideButton}
          onPress={confirmSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={editingEvent ? 'Update' : 'Add'}
        >
          <Text style={[styles.headerAddText, saving && styles.headerActionDisabled]}>{editingEvent ? 'Update' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {loadingOptions ? (
        <View style={styles.contentCard}>
          <Text style={styles.loadingText}>Loading options...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentCard}>
          {selectedOption && (
            <View style={styles.servingSection}>
              <Text style={styles.servingLabel}>
                {selectedOption.name}
                {effectiveDefaultVolForDisplay ? ` ${formatVolume(effectiveDefaultVolForDisplay, measurementSystem)}` : ''}
                {selectedOption.drug_amount ? `${effectiveDefaultVolForDisplay ? ' • ' : ''}${selectedOption.drug_amount} ${habit?.unit}` : ''}
                {(effectiveDefaultVolForDisplay || selectedOption.drug_amount) ? ' per serving' : ''}
              </Text>
              <View style={styles.servingButtons}>
                {[0.5, 1, 2].map((serving) => {
                  const totalDrugAmount = selectedOption.drug_amount * serving;
                  const totalVolume = effectiveDefaultVolForDisplay ? Math.round(effectiveDefaultVolForDisplay * serving) : null;
                  return (
                    <TouchableOpacity
                      key={serving}
                      style={[styles.servingButton, selectedServing === serving && !showCustomVolume && styles.servingButtonSelected]}
                      onPress={() => {
                        setSelectedServing(serving);
                        setShowCustomVolume(false);
                        setCustomVolume('');
                        setCustomDrugAmount(0);
                      }}
                    >
                      <Text style={[styles.servingButtonText, selectedServing === serving && !showCustomVolume && styles.servingButtonTextSelected]}>{serving}x</Text>
                      <Text style={[styles.servingAmountText, selectedServing === serving && !showCustomVolume && styles.servingAmountTextSelected]}>
                        {totalVolume ? formatVolume(totalVolume, measurementSystem) : ''}
                        {(totalVolume || totalDrugAmount) && (totalVolume && totalDrugAmount) ? '\n' : ''}
                        {totalDrugAmount ? `${totalDrugAmount.toFixed(1)}${habit?.unit}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.servingButton, showCustomVolume && styles.servingButtonSelected]}
                  onPress={() => {
                    setSelectedServing('custom');
                    setShowCustomVolume(true);
                    const defaultVolume = effectiveDefaultVolForDisplay ? mlToUserUnit(effectiveDefaultVolForDisplay, measurementSystem) : '';
                    setCustomVolume(defaultVolume);
                    customVolumeRef.current = defaultVolume;
                    setCustomDrugAmount(selectedOption.drug_amount || 0);
                  }}
                >
                  <Text style={[styles.servingButtonText, showCustomVolume && styles.servingButtonTextSelected]}>Other</Text>
                  <Text style={[styles.servingAmountText, showCustomVolume && styles.servingAmountTextSelected]}>Custom{'\n'}Amount</Text>
                </TouchableOpacity>
              </View>

              {showCustomVolume && (
                <View style={styles.customVolumeSection}>
                  <Text style={styles.customVolumeLabel}>Custom Volume:</Text>
                  <View style={styles.customVolumeInputRow} collapsable={false}>
                    <TextInput
                      style={styles.customVolumeInput}
                      defaultValue={customVolume}
                      onChangeText={handleCustomVolumeChange}
                      onBlur={handleCustomVolumeBlur}
                      placeholder={customVolumePlaceholder}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                      maxLength={4}
                    />
                    <Text style={styles.customVolumeUnit}>{getVolumeUnitLabel(measurementSystem)}</Text>
                    <Text style={styles.customVolumeArrow}>→</Text>
                    <View style={styles.customAmountWithLabel}>
                      <Text style={styles.customVolumeResult}>
                        {customAmountDisplayValue.toFixed(1)} {selectedOption?.drug_unit || habit?.unit}
                      </Text>
                      {getActiveIngredientLabel() ? (
                        <Text style={styles.customVolumeIngredientLabel}>({getActiveIngredientLabel()})</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {isQuickAdd && (
            <View style={styles.amountInputContainer}>
              <Text style={styles.amountLabel}>
                Amount ({habit?.name?.toLowerCase().includes('caffeine') ? 'mg' : 'units'})
              </Text>
              <TextInput
                style={styles.amountInput}
                value={quickAddAmount}
                onChangeText={setQuickAddAmount}
                placeholder={habit?.name?.toLowerCase().includes('caffeine') ? '95' : '1'}
                keyboardType="phone-pad"
                autoCorrect={false}
                maxLength={4}
              />
            </View>
          )}

          <View style={styles.timeSection}>
            <Text style={styles.timeSectionLabel}>Time</Text>
            {Platform.OS === 'ios' ? (
              <View style={styles.timePickerIosWrap}>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="compact"
                  onChange={onNativeTimeChange}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.timeRowAndroid}
                  onPress={() => setAndroidTimePickerVisible(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Time ${formatTimeLabel(selectedTime)}, tap to change`}
                >
                  <Text style={styles.timeRowAndroidText}>{formatTimeLabel(selectedTime)}</Text>
                  <Ionicons name="time-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                {androidTimePickerVisible && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="default"
                    onChange={onNativeTimeChange}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.quickTimeOptions}>
            <Text style={styles.quickTimeLabel}>Quick time</Text>
            <View style={styles.quickTimeButtons}>
              {[
                ['Now', 'now'],
                ['Morning', 10],
                ['Afternoon', 15],
                ['Evening', 19],
              ].map(([label, key]) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.quickTimeButton, saving && styles.quickTimeButtonDisabled]}
                  disabled={saving}
                  onPress={() => {
                    if (key === 'now') {
                      performQuickSave(getNowOnSelectedDay());
                    } else {
                      const t = new Date(selectedDateObj);
                      t.setHours(key, 0, 0, 0);
                      performQuickSave(t);
                    }
                  }}
                >
                  <Text style={styles.quickTimeButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingBottom: spacing.regular,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerSideButton: {
    minWidth: 64,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  headerCancelText: {
    fontSize: typography.sizes.body,
    color: colors.white,
    fontWeight: typography.weights.medium,
  },
  headerAddText: {
    fontSize: typography.sizes.body,
    color: colors.white,
    fontWeight: typography.weights.semibold,
    textAlign: 'right',
  },
  headerActionDisabled: {
    opacity: 0.45,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.sizes.small,
    color: colors.white,
    opacity: 0.9,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  errorText: {
    padding: spacing.regular,
    color: colors.textSecondary,
  },
  loadingText: {
    padding: spacing.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.regular,
    paddingBottom: spacing.xxl,
  },
  contentCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    overflow: 'hidden',
  },
  servingSection: {
    marginBottom: spacing.sm,
  },
  servingLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  servingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  servingButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  servingButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  servingButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  servingButtonTextSelected: {
    color: '#FFFFFF',
  },
  servingAmountText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  servingAmountTextSelected: {
    color: '#FFFFFF',
  },
  customVolumeSection: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customVolumeLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  customVolumeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customVolumeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 80,
  },
  customVolumeUnit: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  customVolumeArrow: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    fontWeight: typography.weights.bold,
  },
  customVolumeResult: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    minWidth: 60,
    textAlign: 'center',
  },
  customAmountWithLabel: {
    alignItems: 'center',
    minWidth: 80,
  },
  customVolumeIngredientLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountInputContainer: {
    marginBottom: spacing.sm,
  },
  amountLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    keyboardType: 'phone-pad',
  },
  timeSection: {
    marginBottom: spacing.sm,
  },
  timeSectionLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: typography.weights.semibold,
  },
  timePickerIosWrap: {
    alignSelf: 'flex-start',
  },
  timeRowAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  timeRowAndroidText: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  quickTimeOptions: {
    marginBottom: spacing.sm,
  },
  quickTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  quickTimeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickTimeButton: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 72,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTimeButtonDisabled: {
    opacity: 0.5,
  },
  quickTimeButtonText: {
    fontSize: typography.sizes.small,
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
});

export default LogConsumptionScreen;
