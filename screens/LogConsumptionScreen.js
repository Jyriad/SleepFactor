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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import consumptionOptionsService from '../services/consumptionOptionsService';
import insightsService from '../services/insightsService';
import { supabase } from '../services/supabase';
import offlineWriteQueueService from '../services/offlineWriteQueueService';
import sleepDataService from '../services/sleepDataService';
import {
  getLastCustomAmountForOption,
  setLastCustomAmountForOption,
} from '../services/consumptionCustomAmountStorage';
import { getBedtimeDrugLevel, habitUsesCaffeineMgFloor, CAFFEINE_MG_FLOOR } from '../utils/drugHalfLife';
import { formatVolume, getVolumeUnitLabel, parseVolumeInputToMl, mlToUserUnit } from '../utils/unitConversion';
import {
  INTAKE_BASIS,
  resolveIntakeBasis,
  getReferenceVolumeMlForOption,
  getReferenceServingCount,
  amountFromVolumeMl,
  amountFromServingCount,
  getLoggedVolumeMl,
  getLoggedServingCount,
} from '../utils/consumptionIntake';
import { applyAndroidStatusBarSolidPrimary } from '../utils/androidStatusBar';

const LogConsumptionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
  const [iosTimePickerVisible, setIosTimePickerVisible] = useState(false);
  const [iosDraftTime, setIosDraftTime] = useState(() => new Date(selectedDateObj));
  const [selectedTimePreset, setSelectedTimePreset] = useState(null);
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const customVolumeRef = useRef('');
  const [customAmountDisplayValue, setCustomAmountDisplayValue] = useState(selectedOption?.drug_amount ?? customDrugAmount ?? 0);

  useEffect(() => {
    if (showCustomVolume) {
      setCustomAmountDisplayValue(customDrugAmount ?? 0);
      return;
    }
    setCustomAmountDisplayValue(selectedOption?.drug_amount ?? 0);
  }, [selectedOption?.drug_amount, customDrugAmount, showCustomVolume]);

  // Prefill form when editing an existing event
  useEffect(() => {
    if (!editingEvent || !selectedOption) return;
    const resolvedOption = selectedOption;
    const basis = resolveIntakeBasis(resolvedOption);
    let useCustom = editingEvent.serving === 'custom';
    let presetServing = editingEvent.serving && editingEvent.serving !== 'custom' ? editingEvent.serving : 1;

    if (basis === INTAKE_BASIS.SERVING_COUNT) {
      const refCount = getReferenceServingCount(resolvedOption);
      const totalCount = getLoggedServingCount(editingEvent);
      if (totalCount != null && totalCount > 0 && refCount) {
        const tolerance = 0.05;
        let matched = false;
        for (const mult of [0.5, 1, 2]) {
          const expected = refCount * mult;
          if (Math.abs(totalCount - expected) <= tolerance) {
            presetServing = mult;
            matched = true;
            break;
          }
        }
        if (!matched) useCustom = true;
      } else if (totalCount != null && totalCount > 0) {
        useCustom = true;
      }

      if (useCustom) {
        setSelectedServing('custom');
        setShowCustomVolume(true);
        setCustomDrugAmount(editingEvent.amount ?? 0);
        setCustomAmountDisplayValue(editingEvent.amount ?? 0);
        const countStr = totalCount != null && totalCount > 0 ? String(totalCount) : String(refCount || 1);
        setCustomVolume(countStr);
        customVolumeRef.current = countStr;
      } else {
        setSelectedServing(presetServing);
        setShowCustomVolume(false);
        setCustomVolume('');
        setCustomDrugAmount(0);
      }
      return;
    }

    const volumeMl = getLoggedVolumeMl(editingEvent);
    const effectiveDefaultVol =
      getReferenceVolumeMlForOption(resolvedOption, habit?.name, measurementRegion) ??
      resolvedOption.default_volume ??
      null;

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
  }, [editingEvent?.id, selectedOption?.id, habit?.name, measurementRegion, measurementSystem]);

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

  const calculateCustomDrugAmountFromText = useCallback(
    (text) => {
      if (!selectedOption || !selectedOption.drug_amount) return 0;
      const basis = resolveIntakeBasis(selectedOption);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const n = parseFloat(String(text).replace(',', '.'));
        if (n == null || Number.isNaN(n) || n <= 0) return 0;
        return amountFromServingCount(selectedOption, n);
      }
      const inputUnit = getVolumeUnitLabel(measurementSystem);
      const volumeMl = parseVolumeInputToMl(text, measurementSystem, inputUnit);
      return amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeMl);
    },
    [selectedOption, habit?.name, measurementRegion, measurementSystem]
  );

  const selectedIntakeBasis = useMemo(
    () => (selectedOption ? resolveIntakeBasis(selectedOption) : null),
    [selectedOption?.id, selectedOption?.serving_unit, selectedOption?.intake_basis]
  );

  const effectiveDefaultVolForDisplay = useMemo(
    () =>
      selectedOption && selectedIntakeBasis === INTAKE_BASIS.VOLUME_ML
        ? getReferenceVolumeMlForOption(selectedOption, habit?.name, measurementRegion)
        : null,
    [selectedOption?.id, selectedOption?.name, habit?.name, measurementRegion, selectedIntakeBasis]
  );

  const refServingForDisplay = useMemo(
    () =>
      selectedOption && selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT
        ? getReferenceServingCount(selectedOption)
        : null,
    [selectedOption?.id, selectedIntakeBasis]
  );

  const customVolumePlaceholder = useMemo(() => {
    if (selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT && refServingForDisplay != null) {
      return String(refServingForDisplay);
    }
    return effectiveDefaultVolForDisplay ? mlToUserUnit(effectiveDefaultVolForDisplay, measurementSystem) : '100';
  }, [selectedIntakeBasis, refServingForDisplay, effectiveDefaultVolForDisplay, measurementSystem]);

  const getDefaultCustomInputValue = useCallback(() => {
    if (selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT) {
      return String(refServingForDisplay ?? 1);
    }
    return effectiveDefaultVolForDisplay
      ? mlToUserUnit(effectiveDefaultVolForDisplay, measurementSystem)
      : '';
  }, [selectedIntakeBasis, refServingForDisplay, effectiveDefaultVolForDisplay, measurementSystem]);

  const applyCustomInputValue = useCallback(
    (value) => {
      const resolved = String(value ?? '').trim();
      const finalValue = resolved || getDefaultCustomInputValue();
      setCustomVolume(finalValue);
      customVolumeRef.current = finalValue;
      const calculatedAmount = calculateCustomDrugAmountFromText(finalValue);
      setCustomDrugAmount(calculatedAmount);
      setCustomAmountDisplayValue(calculatedAmount);
    },
    [getDefaultCustomInputValue, calculateCustomDrugAmountFromText]
  );

  const handleSelectCustomServing = useCallback(async () => {
    setSelectedServing('custom');
    setShowCustomVolume(true);

    const fallback = getDefaultCustomInputValue();
    if (!selectedOption?.id || !userId) {
      applyCustomInputValue(fallback);
      return;
    }

    const remembered = await getLastCustomAmountForOption(userId, selectedOption.id);
    applyCustomInputValue(remembered ?? fallback);
  }, [getDefaultCustomInputValue, selectedOption?.id, userId, applyCustomInputValue]);

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
      const { error: dlErr } = await supabase.from('drug_levels').upsert(drugLevelEntry, { onConflict: 'user_id,habit_id,date' });
      if (!dlErr) insightsService.notifyInsightsUnderlyingDataChanged();
    } catch (err) {}
  }, [userId]);

  const handleCustomVolumeBlur = useCallback(() => {
    const calculatedAmount = calculateCustomDrugAmountFromText(customVolumeRef.current ?? '');
    setCustomAmountDisplayValue(calculatedAmount);
  }, [calculateCustomDrugAmountFromText]);

  const handleCustomVolumeChange = useCallback(
    (text) => {
      setCustomVolume(text);
      customVolumeRef.current = text;
      const calculatedAmount = calculateCustomDrugAmountFromText(text);
      setCustomAmountDisplayValue(calculatedAmount);
    },
    [calculateCustomDrugAmountFromText]
  );

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
      setSelectedTimePreset(null);
      setSelectedTime(mergeTimeOntoSelectedDay(date));
    }
  }, [mergeTimeOntoSelectedDay]);

  const onIosDraftTimeChange = useCallback((_, date) => {
    if (date) {
      setIosDraftTime(mergeTimeOntoSelectedDay(date));
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
    let volumeConsumed = null;
    let loggedIntakeBasis = INTAKE_BASIS.DIRECT_AMOUNT;
    let loggedVolumeMl = null;
    let loggedServingCount = null;
    let servingMultiplier;

    if (selectedServing === 'custom' && selectedOption) {
      const basis = resolveIntakeBasis(selectedOption);
      const raw = customVolumeRef.current ?? customVolume;
      await setLastCustomAmountForOption(userId, selectedOption.id, raw);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const count = parseFloat(String(raw).replace(',', '.')) || 0;
        totalAmount = amountFromServingCount(selectedOption, count);
        loggedIntakeBasis = INTAKE_BASIS.SERVING_COUNT;
        loggedServingCount = count > 0 ? count : null;
      } else {
        const inputUnit = getVolumeUnitLabel(measurementSystem);
        const volumeStr = raw;
        volumeConsumed =
          parseVolumeInputToMl(volumeStr, measurementSystem, inputUnit) || selectedOption?.default_volume || 0;
        totalAmount = amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeConsumed);
        loggedIntakeBasis = INTAKE_BASIS.VOLUME_ML;
        loggedVolumeMl = volumeConsumed > 0 ? volumeConsumed : null;
      }
      servingMultiplier = 'custom';
    } else if (selectedOption) {
      servingMultiplier = selectedServing || 1;
      const basis = resolveIntakeBasis(selectedOption);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const refCount = getReferenceServingCount(selectedOption);
        const totalCount = refCount * servingMultiplier;
        totalAmount = amountFromServingCount(selectedOption, totalCount);
        loggedIntakeBasis = INTAKE_BASIS.SERVING_COUNT;
        loggedServingCount = totalCount;
      } else {
        const refMl =
          getReferenceVolumeMlForOption(selectedOption, habit?.name, measurementRegion) ??
          selectedOption?.default_volume ??
          resolvedOption?.default_volume ??
          1;
        volumeConsumed = refMl ? refMl * servingMultiplier : 0;
        totalAmount = amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeConsumed);
        loggedIntakeBasis = INTAKE_BASIS.VOLUME_ML;
        loggedVolumeMl = volumeConsumed > 0 ? volumeConsumed : null;
      }
    } else {
      totalAmount = parseFloat(quickAddAmount) || baseAmount;
      drinkType = null;
      servingMultiplier = 'custom';
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

    const writeRow = {
      habit_id: habit.id,
      user_id: userId,
      consumed_at: consumptionTime.toISOString(),
      amount: totalAmount,
      volume: loggedVolumeMl,
      drink_type: drinkType,
      logged_intake_basis: loggedIntakeBasis,
      logged_volume_ml: loggedVolumeMl,
      logged_serving_count: loggedServingCount,
    };

    const { data, error } = await supabase
      .from('habit_consumption_events')
      .insert(writeRow)
      .select()
      .single();

    if (error) {
      await offlineWriteQueueService.enqueue(
        offlineWriteQueueService.ACTION_TYPES.CONSUMPTION_CREATE,
        { row: writeRow }
      );
      onSaveSuccess?.();
      navigation.goBack();
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    navigation.goBack();
  }, [
    habit,
    userId,
    selectedOption,
    selectedServing,
    customVolume,
    quickAddAmount,
    measurementSystem,
    measurementRegion,
    resolveConsumptionType,
    selectedDateObj,
    updateBedtimeDrugLevel,
    onSaveSuccess,
    navigation,
  ]);

  const updateConsumptionEvent = useCallback(async (eventId, consumptionType, consumptionTime) => {
    if (!habit?.id || !userId) return;
    const resolvedOption = resolveConsumptionType(consumptionType);
    let totalAmount = 0;
    let loggedIntakeBasis = INTAKE_BASIS.DIRECT_AMOUNT;
    let loggedVolumeMl = null;
    let loggedServingCount = null;

    if (selectedServing === 'custom' && selectedOption) {
      const basis = resolveIntakeBasis(selectedOption);
      const raw = customVolumeRef.current ?? customVolume;
      await setLastCustomAmountForOption(userId, selectedOption.id, raw);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const count = parseFloat(String(raw).replace(',', '.')) || 0;
        totalAmount = amountFromServingCount(selectedOption, count);
        loggedIntakeBasis = INTAKE_BASIS.SERVING_COUNT;
        loggedServingCount = count > 0 ? count : null;
      } else {
        const inputUnit = getVolumeUnitLabel(measurementSystem);
        const volumeConsumed =
          parseVolumeInputToMl(raw, measurementSystem, inputUnit) || resolvedOption?.default_volume || 0;
        totalAmount = amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeConsumed);
        loggedIntakeBasis = INTAKE_BASIS.VOLUME_ML;
        loggedVolumeMl = volumeConsumed > 0 ? volumeConsumed : null;
      }
    } else if (selectedOption) {
      const servingMultiplier = selectedServing || 1;
      const basis = resolveIntakeBasis(selectedOption);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const refCount = getReferenceServingCount(selectedOption);
        const totalCount = refCount * servingMultiplier;
        totalAmount = amountFromServingCount(selectedOption, totalCount);
        loggedIntakeBasis = INTAKE_BASIS.SERVING_COUNT;
        loggedServingCount = totalCount;
      } else {
        const refMl =
          getReferenceVolumeMlForOption(selectedOption, habit?.name, measurementRegion) ??
          resolvedOption?.default_volume ??
          1;
        const volumeConsumed = refMl ? refMl * servingMultiplier : 0;
        totalAmount = amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeConsumed);
        loggedIntakeBasis = INTAKE_BASIS.VOLUME_ML;
        loggedVolumeMl = volumeConsumed > 0 ? volumeConsumed : null;
      }
    }

    const updates = {
      consumed_at: consumptionTime.toISOString(),
      amount: totalAmount,
      volume: loggedVolumeMl,
      drink_type: resolvedOption?.id || consumptionType,
      logged_intake_basis: loggedIntakeBasis,
      logged_volume_ml: loggedVolumeMl,
      logged_serving_count: loggedServingCount,
    };

    const { error: updateError } = await supabase
      .from('habit_consumption_events')
      .update(updates)
      .eq('id', eventId);

    if (updateError) {
      await offlineWriteQueueService.enqueue(
        offlineWriteQueueService.ACTION_TYPES.CONSUMPTION_UPDATE,
        { eventId, userId, updates }
      );
      onSaveSuccess?.();
      navigation.goBack();
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    navigation.goBack();
  }, [
    habit,
    userId,
    selectedOption,
    selectedServing,
    customVolume,
    measurementSystem,
    measurementRegion,
    resolveConsumptionType,
    selectedDateObj,
    updateBedtimeDrugLevel,
    onSaveSuccess,
    navigation,
  ]);

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

  const handleSelectTimePreset = useCallback(
    (presetKey) => {
      if (saving) return;
      if (presetKey === 'now') {
        setSelectedTime(getNowOnSelectedDay());
        setSelectedTimePreset('now');
        return;
      }
      const presetMap = {
        morning: 10,
        afternoon: 15,
        evening: 19,
      };
      const presetHour = presetMap[presetKey];
      if (presetHour == null) return;
      const t = new Date(selectedDateObj);
      t.setHours(presetHour, 0, 0, 0);
      setSelectedTime(t);
      setSelectedTimePreset(presetKey);
    },
    [saving, getNowOnSelectedDay, selectedDateObj]
  );

  const getActiveIngredientLabel = () => {
    const name = (habit?.name || '').toLowerCase();
    if (name.includes('caffeine')) return 'caffeine';
    if (name.includes('alcohol')) return 'alcohol';
    return null;
  };

  const getServingUnitLabel = useCallback(
    (option) => {
      const name = (habit?.name || '').toLowerCase();
      if (name.includes('alcohol')) return option?.serving_unit || 'ml';
      return option?.serving_unit || 'units';
    },
    [habit?.name]
  );


  useFocusEffect(
    useCallback(() => {
      applyAndroidStatusBarSolidPrimary();
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
        <View style={styles.headerSideSpacer} />
      </View>

      {loadingOptions ? (
        <View style={styles.contentCard}>
          <Text style={styles.loadingText}>Loading options...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xxl + tabBarHeight + 96 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentCard}>
          {selectedOption && (
            <View style={styles.servingSection}>
              <Text style={styles.servingLabel}>
                {selectedOption.name}
                {selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT && refServingForDisplay != null
                  ? ` ${refServingForDisplay} ${getServingUnitLabel(selectedOption)}`
                  : ''}
                {selectedIntakeBasis === INTAKE_BASIS.VOLUME_ML && effectiveDefaultVolForDisplay
                  ? ` ${formatVolume(effectiveDefaultVolForDisplay, measurementSystem)}`
                  : ''}
                {selectedOption.drug_amount
                  ? `${(effectiveDefaultVolForDisplay || (selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT && refServingForDisplay != null)) ? ' • ' : ''}${selectedOption.drug_amount} ${habit?.unit}`
                  : ''}
                {(effectiveDefaultVolForDisplay ||
                  (selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT && refServingForDisplay != null) ||
                  selectedOption.drug_amount)
                  ? ' per serving'
                  : ''}
              </Text>
              <View style={styles.servingButtons}>
                {[0.5, 1, 2].map((serving) => {
                  const refVol = effectiveDefaultVolForDisplay;
                  const refSrv = refServingForDisplay;
                  let totalDrugAmount = selectedOption.drug_amount * serving;
                  let totalVolume = refVol ? Math.round(refVol * serving) : null;
                  let servingSizeLine = '';
                  if (selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT && refSrv != null) {
                    const totalCount = refSrv * serving;
                    totalDrugAmount = amountFromServingCount(selectedOption, totalCount);
                    const n = Number.isInteger(totalCount) ? totalCount : Math.round(totalCount * 10) / 10;
                    servingSizeLine = `${n} ${selectedOption.serving_unit || ''}`.trim();
                  }
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
                        {selectedIntakeBasis === INTAKE_BASIS.VOLUME_ML && totalVolume
                          ? formatVolume(totalVolume, measurementSystem)
                          : servingSizeLine}
                        {((selectedIntakeBasis === INTAKE_BASIS.VOLUME_ML && totalVolume) || servingSizeLine) && totalDrugAmount ? '\n' : ''}
                        {totalDrugAmount ? `${totalDrugAmount.toFixed(1)}${habit?.unit}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.servingButton, showCustomVolume && styles.servingButtonSelected]}
                  onPress={handleSelectCustomServing}
                >
                  <Text style={[styles.servingButtonText, showCustomVolume && styles.servingButtonTextSelected]}>Other</Text>
                  <Text style={[styles.servingAmountText, showCustomVolume && styles.servingAmountTextSelected]}>Custom{'\n'}Amount</Text>
                </TouchableOpacity>
              </View>

              {showCustomVolume && (
                <View style={styles.customVolumeSection}>
                  <Text style={styles.customVolumeLabel}>
                    {selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT ? 'Custom amount:' : 'Custom volume:'}
                  </Text>
                  <View style={styles.customVolumeInputRow} collapsable={false}>
                    <TextInput
                      style={styles.customVolumeInput}
                      value={customVolume}
                      onChangeText={handleCustomVolumeChange}
                      onBlur={handleCustomVolumeBlur}
                      placeholder={customVolumePlaceholder}
                      keyboardType="decimal-pad"
                      autoCorrect={false}
                      maxLength={6}
                    />
                    <Text style={styles.customVolumeUnit}>
                      {selectedIntakeBasis === INTAKE_BASIS.SERVING_COUNT
                        ? getServingUnitLabel(selectedOption)
                        : getVolumeUnitLabel(measurementSystem)}
                    </Text>
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
                Amount (
                {habit?.name?.toLowerCase().includes('caffeine')
                  ? 'mg'
                  : habit?.name?.toLowerCase().includes('alcohol')
                    ? 'ml'
                    : 'units'}
                )
              </Text>
              <TextInput
                style={styles.amountInput}
                value={quickAddAmount}
                onChangeText={setQuickAddAmount}
                placeholder={
                  habit?.name?.toLowerCase().includes('caffeine')
                    ? '95'
                    : habit?.name?.toLowerCase().includes('alcohol')
                      ? '12.7'
                      : '1'
                }
                keyboardType="phone-pad"
                autoCorrect={false}
                maxLength={4}
              />
            </View>
          )}

          <View style={styles.timeSection}>
            <Text style={styles.timeSectionLabel}>When did you have it?</Text>
            <Text style={styles.timeSectionHint}>Pick a preset or choose an exact time.</Text>

            <View style={styles.timePresetButtons}>
              {[
                ['Now', 'now'],
                ['Morning', 'morning'],
                ['Afternoon', 'afternoon'],
                ['Evening', 'evening'],
              ].map(([label, key]) => (
                <TouchableOpacity
                  key={String(key)}
                  style={[
                    styles.timePresetButton,
                    selectedTimePreset === key && styles.timePresetButtonSelected,
                    saving && styles.timePresetButtonDisabled,
                  ]}
                  disabled={saving}
                  onPress={() => handleSelectTimePreset(key)}
                >
                  <Text
                    style={[
                      styles.timePresetButtonText,
                      selectedTimePreset === key && styles.timePresetButtonTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.exactTimeButton}
              onPress={() => {
                setSelectedTimePreset(null);
                if (Platform.OS === 'android') {
                  setAndroidTimePickerVisible(true);
                  return;
                }
                setIosDraftTime(selectedTime);
                setIosTimePickerVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Choose exact time, currently ${formatTimeLabel(selectedTime)}`}
            >
              <View>
                <Text style={styles.exactTimeLabel}>Choose exact time</Text>
                <Text style={styles.exactTimeValue}>{formatTimeLabel(selectedTime)}</Text>
              </View>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
            </TouchableOpacity>

            {Platform.OS === 'android' && androidTimePickerVisible ? (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="default"
                onChange={onNativeTimeChange}
              />
            ) : null}

            <Text style={styles.timePreviewText}>Logging for {formatTimeLabel(selectedTime)}</Text>
          </View>
          </View>
        </ScrollView>
      )}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosTimePickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIosTimePickerVisible(false)}
        >
          <Pressable style={styles.iosTimeModalOverlay} onPress={() => setIosTimePickerVisible(false)}>
            <Pressable style={styles.iosTimeModalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.iosTimeModalHeader}>
                <TouchableOpacity
                  onPress={() => setIosTimePickerVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel time selection"
                >
                  <Text style={styles.iosTimeModalCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedTimePreset(null);
                    setSelectedTime(iosDraftTime);
                    setIosTimePickerVisible(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting time"
                >
                  <Text style={styles.iosTimeModalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosDraftTime}
                mode="time"
                display="spinner"
                onChange={onIosDraftTimeChange}
                style={styles.iosTimeModalPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <View style={[styles.bottomActionBar, { bottom: tabBarHeight, paddingBottom: 2 + Math.min(insets.bottom, spacing.xs) }]}>
        <TouchableOpacity
          style={[styles.bottomActionButton, saving && styles.bottomActionButtonDisabled]}
          onPress={confirmSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={editingEvent ? 'Update consumption' : 'Add consumption'}
        >
          <Text style={styles.bottomActionButtonText}>{editingEvent ? 'Update consumption' : 'Add consumption'}</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: colors.primaryDark,
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
  headerSideSpacer: {
    minWidth: 64,
  },
  headerCancelText: {
    fontSize: typography.sizes.body,
    color: colors.white,
    fontWeight: typography.weights.medium,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    borderRadius: BUTTON_BORDER_RADIUS,
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
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    keyboardType: 'phone-pad',
  },
  timeSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  timeSectionLabel: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: typography.weights.semibold,
  },
  timeSectionHint: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  timePresetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  timePresetButton: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  timePresetButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timePresetButtonText: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  timePresetButtonTextSelected: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  timePresetButtonDisabled: {
    opacity: 0.5,
  },
  exactTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  exactTimeLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  exactTimeValue: {
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  iosTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  iosTimeModalSheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 28,
  },
  iosTimeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.regular,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosTimeModalCancel: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  iosTimeModalDone: {
    fontSize: typography.sizes.body,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  iosTimeModalPicker: {
    width: '100%',
    height: 216,
  },
  timePreviewText: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  bottomActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomActionButton: {
    backgroundColor: colors.primary,
    borderRadius: BUTTON_BORDER_RADIUS,
    paddingVertical: spacing.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionButtonDisabled: {
    opacity: 0.5,
  },
  bottomActionButtonText: {
    fontSize: typography.sizes.body,
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});

export default LogConsumptionScreen;
