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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { colors } from '../constants/colors';
import { typography, spacing, BUTTON_BORDER_RADIUS } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import consumptionOptionsService from '../services/consumptionOptionsService';
import insightsService from '../services/insightsService';
import { supabase } from '../services/supabase';
import offlineWriteQueueService from '../services/offlineWriteQueueService';
import { requestDateStripLoggedRefresh } from '../services/dateStripBadgeRefresh';
import sleepDataService from '../services/sleepDataService';
import {
  getLastConsumptionPreferenceForOption,
  setLastConsumptionPreferenceForOption,
  SERVING_PROFILE_CUSTOM,
} from '../services/consumptionCustomAmountStorage';
import { calculateAlcoholMl } from '../constants/consumptionReferenceData';
import {
  getServingProfilesForOption,
  getDefaultServingProfile,
  getDefaultAbvForOption,
  getAbvRangeForOption,
  clampAbvToRange,
  formatAbvRangeHint,
  computeAmountForCustomVolume,
  formatProfileSubtitle,
  resolveEditServingSelection,
  resolveServingProfileIdForOpen,
  getProfileById,
  isAlcoholHabit as isAlcoholHabitName,
} from '../constants/consumptionServingProfiles';
import { buildConsumptionLogFields } from '../utils/consumptionLogPayload';
import { getBedtimeDrugLevel, habitUsesCaffeineMgFloor, CAFFEINE_MG_FLOOR } from '../utils/drugHalfLife';
import { getVolumeUnitLabel, parseVolumeInputToMl, mlToUserUnit } from '../utils/unitConversion';
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
import AppSheetLayout from '../components/AppSheetLayout';
import { applyAndroidStatusBarSolidPrimary } from '../utils/androidStatusBar';

const LogConsumptionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { preferences } = useUserPreferences();
  const measurementRegion = preferences.measurementRegion || 'metric';
  const measurementSystem = preferences.measurementSystem || 'metric';

  const { habit, selectedDate, userId, editingEvent, onSaveSuccess, prefill } = route.params || {};
  const routeSelectedOption = route.params?.selectedOption;

  const selectedDateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate ?? Date.now());

  const [consumptionOptions, setConsumptionOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(!!habit?.id);
  const [selectedOption, setSelectedOption] = useState(routeSelectedOption ?? null);
  const [selectedServing, setSelectedServing] = useState(null);
  const [abvPercent, setAbvPercent] = useState(null);
  const [abvInputText, setAbvInputText] = useState('');
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

  useEffect(() => {
    setSelectedOption(routeSelectedOption ?? null);
  }, [routeSelectedOption?.id]);

  const isAlcohol = useMemo(
    () => isAlcoholHabitName(habit?.name),
    [habit?.name]
  );

  const servingProfiles = useMemo(
    () =>
      selectedOption
        ? getServingProfilesForOption(selectedOption, habit?.name, measurementRegion)
        : [],
    [selectedOption?.id, selectedOption?.name, selectedOption?.serving_profiles, habit?.name, measurementRegion]
  );

  const defaultAbv = useMemo(
    () =>
      selectedOption && isAlcohol
        ? getDefaultAbvForOption(selectedOption, habit?.name, measurementRegion)
        : null,
    [selectedOption?.id, selectedOption?.default_abv_percent, habit?.name, measurementRegion, isAlcohol]
  );

  const abvRange = useMemo(() => {
    if (!selectedOption || !isAlcohol) return null;
    const expandFor =
      editingEvent?.logged_abv_percent != null
        ? Number(editingEvent.logged_abv_percent)
        : null;
    return getAbvRangeForOption(selectedOption, habit?.name, measurementRegion, {
      expandForValue: expandFor,
    });
  }, [
    selectedOption?.id,
    selectedOption?.name,
    selectedOption?.default_abv_percent,
    habit?.name,
    measurementRegion,
    isAlcohol,
    editingEvent?.logged_abv_percent,
  ]);

  const effectiveAbv = useMemo(() => {
    if (!isAlcohol || !abvRange) return null;
    const parsed = parseFloat(String(abvInputText).replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed >= abvRange.min && parsed <= abvRange.max) return parsed;
    if (abvPercent != null && abvPercent >= abvRange.min && abvPercent <= abvRange.max) {
      return abvPercent;
    }
    return clampAbvToRange(defaultAbv ?? abvRange.min, abvRange);
  }, [isAlcohol, abvInputText, abvPercent, defaultAbv, abvRange]);

  const effectiveAbvRef = useRef(effectiveAbv);
  effectiveAbvRef.current = effectiveAbv;

  // Prefill form when editing an existing event
  useEffect(() => {
    if (!editingEvent || !selectedOption) return;

    const profiles = getServingProfilesForOption(selectedOption, habit?.name, measurementRegion);
    const resolved = resolveEditServingSelection(
      editingEvent,
      selectedOption,
      profiles,
      habit?.name,
      measurementRegion
    );

    if (isAlcohol && abvRange) {
      const abv = clampAbvToRange(
        resolved.abvPercent ?? getDefaultAbvForOption(selectedOption, habit?.name, measurementRegion),
        abvRange
      );
      setAbvPercent(abv);
      setAbvInputText(String(abv));
    }

    if (resolved.useCustom) {
      setSelectedServing(SERVING_PROFILE_CUSTOM);
      setShowCustomVolume(true);
      setCustomDrugAmount(editingEvent.amount ?? 0);
      setCustomAmountDisplayValue(editingEvent.amount ?? 0);
      const basis = resolveIntakeBasis(selectedOption);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const count = getLoggedServingCount(editingEvent);
        const countStr = count != null && count > 0 ? String(count) : '1';
        setCustomVolume(countStr);
        customVolumeRef.current = countStr;
      } else {
        const vol = getLoggedVolumeMl(editingEvent);
        const volumeStr = vol ? mlToUserUnit(vol, measurementSystem) : '100';
        setCustomVolume(volumeStr);
        customVolumeRef.current = volumeStr;
      }
      return;
    }

    if (resolved.profileId) {
      setSelectedServing(resolved.profileId);
      setShowCustomVolume(false);
      setCustomVolume('');
      customVolumeRef.current = '';
      setCustomDrugAmount(0);
    }
  }, [editingEvent?.id, selectedOption?.id, habit?.name, measurementRegion, measurementSystem, isAlcohol, abvRange]);

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
      if (!selectedOption) return 0;
      const basis = resolveIntakeBasis(selectedOption);
      if (basis === INTAKE_BASIS.SERVING_COUNT) {
        const n = parseFloat(String(text).replace(',', '.'));
        if (n == null || Number.isNaN(n) || n <= 0) return 0;
        return amountFromServingCount(selectedOption, n);
      }
      const inputUnit = getVolumeUnitLabel(measurementSystem);
      const volumeMl = parseVolumeInputToMl(text, measurementSystem, inputUnit);
      if (isAlcohol) {
        return computeAmountForCustomVolume(
          selectedOption,
          habit?.name,
          measurementRegion,
          volumeMl,
          null,
          effectiveAbvRef.current
        );
      }
      return amountFromVolumeMl(selectedOption, habit?.name, measurementRegion, volumeMl);
    },
    [selectedOption, habit?.name, measurementRegion, measurementSystem, isAlcohol]
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

  const applyCustomInputValueRef = useRef(applyCustomInputValue);
  const getDefaultCustomInputValueRef = useRef(getDefaultCustomInputValue);
  applyCustomInputValueRef.current = applyCustomInputValue;
  getDefaultCustomInputValueRef.current = getDefaultCustomInputValue;

  const handleSelectCustomServing = useCallback(async () => {
    setSelectedServing(SERVING_PROFILE_CUSTOM);
    setShowCustomVolume(true);

    const fallback = getDefaultCustomInputValue();
    if (!selectedOption?.id || !userId) {
      applyCustomInputValue(fallback);
      return;
    }

    const remembered = await getLastConsumptionPreferenceForOption(
      userId,
      selectedOption.id,
      selectedOption,
      habit?.name,
      measurementRegion
    );
    const customValue =
      remembered?.servingProfileId === SERVING_PROFILE_CUSTOM ? remembered.customValue : null;
    applyCustomInputValue(customValue ?? fallback);
  }, [
    getDefaultCustomInputValue,
    selectedOption,
    userId,
    habit?.name,
    measurementRegion,
    applyCustomInputValue,
  ]);

  const openingServingKey = useMemo(
    () =>
      [
        selectedOption?.id ?? '',
        editingEvent?.id ?? '',
        prefill?.servingProfileId ?? '',
        prefill?.volumeMl ?? '',
        prefill?.customVolume ?? '',
        prefill?.abvPercent ?? '',
      ].join('|'),
    [
      selectedOption?.id,
      editingEvent?.id,
      prefill?.servingProfileId,
      prefill?.volumeMl,
      prefill?.customVolume,
      prefill?.abvPercent,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedOption?.id || servingProfiles.length === 0 || editingEvent) return;

      let cancelled = false;

      const applyPrefillAbv = (abv) => {
        if (!isAlcohol || abv == null) return;
        const range = getAbvRangeForOption(selectedOption, habit?.name, measurementRegion);
        const clamped = clampAbvToRange(abv, range);
        setAbvPercent(clamped);
        setAbvInputText(String(clamped));
      };

      const applyNamedProfile = (profileId) => {
        setSelectedServing(profileId);
        setShowCustomVolume(false);
        setCustomVolume('');
        customVolumeRef.current = '';
        setCustomDrugAmount(0);
      };

      const applyDefaultProfile = () => {
        const def = getDefaultServingProfile(servingProfiles);
        if (def) applyNamedProfile(def.id);
        if (isAlcohol) {
          applyPrefillAbv(getDefaultAbvForOption(selectedOption, habit?.name, measurementRegion));
        }
      };

      (async () => {
        if (prefill) {
          const profileId = resolveServingProfileIdForOpen(
            prefill.servingProfileId,
            prefill.volumeMl,
            servingProfiles
          );

          if (profileId) {
            if (!cancelled) {
              applyNamedProfile(profileId);
              applyPrefillAbv(prefill.abvPercent);
            }
            return;
          }

          if (prefill.customVolume || prefill.volumeMl != null) {
            const customVal =
              prefill.customVolume != null
                ? String(prefill.customVolume)
                : mlToUserUnit(prefill.volumeMl, measurementSystem);
            if (!cancelled) {
              setSelectedServing(SERVING_PROFILE_CUSTOM);
              setShowCustomVolume(true);
              applyCustomInputValueRef.current(customVal);
              applyPrefillAbv(prefill.abvPercent);
            }
            return;
          }

          if (!cancelled) applyDefaultProfile();
          return;
        }

        const remembered = await getLastConsumptionPreferenceForOption(
          userId,
          selectedOption.id,
          selectedOption,
          habit?.name,
          measurementRegion
        );
        if (cancelled) return;

        if (!remembered) {
          applyDefaultProfile();
          return;
        }

        if (remembered.abvPercent != null) applyPrefillAbv(remembered.abvPercent);

        if (remembered.servingProfileId === SERVING_PROFILE_CUSTOM) {
          setSelectedServing(SERVING_PROFILE_CUSTOM);
          setShowCustomVolume(true);
          applyCustomInputValueRef.current(
            remembered.customValue ?? getDefaultCustomInputValueRef.current()
          );
          return;
        }

        if (
          remembered.servingProfileId &&
          getProfileById(servingProfiles, remembered.servingProfileId)
        ) {
          applyNamedProfile(remembered.servingProfileId);
          return;
        }

        applyDefaultProfile();
      })();

      return () => {
        cancelled = true;
      };
    }, [
      openingServingKey,
      selectedOption,
      servingProfiles,
      editingEvent,
      prefill,
      userId,
      habit?.name,
      measurementRegion,
      measurementSystem,
      isAlcohol,
    ])
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

  const persistServingPreference = useCallback(async () => {
    if (!userId || !selectedOption?.id) return;
    if (selectedServing === SERVING_PROFILE_CUSTOM) {
      await setLastConsumptionPreferenceForOption(userId, selectedOption.id, {
        servingProfileId: SERVING_PROFILE_CUSTOM,
        customValue: customVolumeRef.current ?? customVolume,
        abvPercent: isAlcohol ? effectiveAbv : undefined,
      });
    } else if (selectedServing) {
      await setLastConsumptionPreferenceForOption(userId, selectedOption.id, {
        servingProfileId: selectedServing,
        abvPercent: isAlcohol ? effectiveAbv : undefined,
      });
    }
  }, [userId, selectedOption?.id, selectedServing, customVolume, isAlcohol, effectiveAbv]);

  const addConsumptionEvent = useCallback(async (consumptionType, consumptionTime) => {
    if (!habit?.id || !userId) return;
    const resolvedOption = resolveConsumptionType(consumptionType);
    let baseAmount = resolvedOption?.drug_amount ?? (habit?.name?.toLowerCase().includes('caffeine') ? 95 : 1);
    let drinkType = consumptionType;

    let logFields = {
      totalAmount: 0,
      loggedIntakeBasis: INTAKE_BASIS.DIRECT_AMOUNT,
      loggedVolumeMl: null,
      loggedServingCount: null,
      loggedServingProfileId: null,
      loggedAbvPercent: null,
    };

    if (selectedOption) {
      await persistServingPreference();
      const effectiveProfileId =
        selectedServing === SERVING_PROFILE_CUSTOM
          ? SERVING_PROFILE_CUSTOM
          : selectedServing || getDefaultServingProfile(servingProfiles)?.id;
      logFields = buildConsumptionLogFields({
        selectedOption,
        habitName: habit?.name,
        measurementRegion,
        measurementSystem,
        servingProfiles,
        selectedProfileId: effectiveProfileId,
        isCustom: effectiveProfileId === SERVING_PROFILE_CUSTOM,
        customVolumeRaw: customVolumeRef.current ?? customVolume,
        volumeUnitLabel: getVolumeUnitLabel(measurementSystem),
        abvPercent: isAlcohol ? effectiveAbv : null,
      });
    } else {
      logFields.totalAmount = parseFloat(quickAddAmount) || baseAmount;
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

    const writeRow = {
      habit_id: habit.id,
      user_id: userId,
      consumed_at: consumptionTime.toISOString(),
      amount: logFields.totalAmount,
      volume: logFields.loggedVolumeMl,
      drink_type: drinkType,
      logged_intake_basis: logFields.loggedIntakeBasis,
      logged_volume_ml: logFields.loggedVolumeMl,
      logged_serving_count: logFields.loggedServingCount,
      logged_serving_profile_id: logFields.loggedServingProfileId,
      logged_abv_percent: logFields.loggedAbvPercent,
    };

    const { data, error } = await supabase
      .from('habit_consumption_events')
      .insert(writeRow)
      .select()
      .single();

    if (error) {
      const queueItemId = await offlineWriteQueueService.enqueue(
        offlineWriteQueueService.ACTION_TYPES.CONSUMPTION_CREATE,
        { row: writeRow }
      );
      onSaveSuccess?.({
        optimisticEvent: {
          id: `pending_${queueItemId}`,
          habit_id: writeRow.habit_id,
          user_id: writeRow.user_id,
          consumed_at: writeRow.consumed_at,
          amount: writeRow.amount,
          drink_type: writeRow.drink_type,
          volume: writeRow.volume,
          logged_intake_basis: writeRow.logged_intake_basis,
          logged_volume_ml: writeRow.logged_volume_ml,
          logged_serving_count: writeRow.logged_serving_count,
          logged_serving_profile_id: writeRow.logged_serving_profile_id,
          logged_abv_percent: writeRow.logged_abv_percent,
          _pendingSync: true,
        },
      });
      requestDateStripLoggedRefresh();
      navigation.goBack();
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    requestDateStripLoggedRefresh();
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
    servingProfiles,
    isAlcohol,
    effectiveAbv,
    persistServingPreference,
    resolveConsumptionType,
    selectedDateObj,
    updateBedtimeDrugLevel,
    onSaveSuccess,
    navigation,
  ]);

  const updateConsumptionEvent = useCallback(async (eventId, consumptionType, consumptionTime) => {
    if (!habit?.id || !userId) return;
    const resolvedOption = resolveConsumptionType(consumptionType);

    await persistServingPreference();
    const effectiveProfileId =
      selectedServing === SERVING_PROFILE_CUSTOM
        ? SERVING_PROFILE_CUSTOM
        : selectedServing || getDefaultServingProfile(servingProfiles)?.id;
    const logFields = selectedOption
      ? buildConsumptionLogFields({
          selectedOption,
          habitName: habit?.name,
          measurementRegion,
          measurementSystem,
          servingProfiles,
          selectedProfileId: effectiveProfileId,
          isCustom: effectiveProfileId === SERVING_PROFILE_CUSTOM,
          customVolumeRaw: customVolumeRef.current ?? customVolume,
          volumeUnitLabel: getVolumeUnitLabel(measurementSystem),
          abvPercent: isAlcohol ? effectiveAbv : null,
        })
      : {
          totalAmount: 0,
          loggedIntakeBasis: INTAKE_BASIS.DIRECT_AMOUNT,
          loggedVolumeMl: null,
          loggedServingCount: null,
          loggedServingProfileId: null,
          loggedAbvPercent: null,
        };

    const updates = {
      consumed_at: consumptionTime.toISOString(),
      amount: logFields.totalAmount,
      volume: logFields.loggedVolumeMl,
      drink_type: resolvedOption?.id || consumptionType,
      logged_intake_basis: logFields.loggedIntakeBasis,
      logged_volume_ml: logFields.loggedVolumeMl,
      logged_serving_count: logFields.loggedServingCount,
      logged_serving_profile_id: logFields.loggedServingProfileId,
      logged_abv_percent: logFields.loggedAbvPercent,
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
      requestDateStripLoggedRefresh();
      navigation.goBack();
      return;
    }
    try {
      await updateBedtimeDrugLevel(habit.id, selectedDateObj);
    } catch (e) {}
    onSaveSuccess?.();
    requestDateStripLoggedRefresh();
    navigation.goBack();
  }, [
    habit,
    userId,
    selectedOption,
    selectedServing,
    customVolume,
    measurementSystem,
    measurementRegion,
    servingProfiles,
    isAlcohol,
    effectiveAbv,
    persistServingPreference,
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
      <AppSheetLayout title="Log consumption">
        <Text style={styles.errorText}>Missing habit.</Text>
      </AppSheetLayout>
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
    <AppSheetLayout
      title={headerTitleText}
      subtitle={headerSubtitleText || undefined}
      scroll={false}
      contentContainerStyle={styles.sheetBody}
    >
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
              <Text style={styles.servingLabel}>Choose a size for {selectedOption.name}</Text>
              <View style={styles.servingButtons}>
                {servingProfiles.map((profile) => {
                  const isSelected =
                    selectedServing === profile.id && selectedServing !== SERVING_PROFILE_CUSTOM;
                  const subtitle = formatProfileSubtitle(
                    profile,
                    selectedOption,
                    habit?.name,
                    measurementRegion,
                    measurementSystem,
                    isAlcohol ? effectiveAbv : null,
                    habit?.unit
                  );
                  return (
                    <TouchableOpacity
                      key={profile.id}
                      style={[styles.servingButton, isSelected && styles.servingButtonSelected]}
                      onPress={() => {
                        setSelectedServing(profile.id);
                        setShowCustomVolume(false);
                        setCustomVolume('');
                        customVolumeRef.current = '';
                        setCustomDrugAmount(0);
                      }}
                    >
                      <Text
                        style={[styles.servingButtonText, isSelected && styles.servingButtonTextSelected]}
                        numberOfLines={2}
                      >
                        {profile.label}
                      </Text>
                      <Text
                        style={[styles.servingAmountText, isSelected && styles.servingAmountTextSelected]}
                        numberOfLines={3}
                      >
                        {subtitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.servingButton,
                    (showCustomVolume || selectedServing === SERVING_PROFILE_CUSTOM) &&
                      styles.servingButtonSelected,
                  ]}
                  onPress={handleSelectCustomServing}
                >
                  <Text
                    style={[
                      styles.servingButtonText,
                      (showCustomVolume || selectedServing === SERVING_PROFILE_CUSTOM) &&
                        styles.servingButtonTextSelected,
                    ]}
                  >
                    Other
                  </Text>
                  <Text
                    style={[
                      styles.servingAmountText,
                      (showCustomVolume || selectedServing === SERVING_PROFILE_CUSTOM) &&
                        styles.servingAmountTextSelected,
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {isAlcohol && abvRange && (
                <View style={styles.abvSection}>
                  <Text style={styles.abvLabel}>Alcohol strength (ABV %)</Text>
                  <Text style={styles.abvHelpText}>{formatAbvRangeHint(selectedOption, abvRange)}</Text>
                  <View style={styles.abvInputRow}>
                    <Slider
                      style={styles.abvSlider}
                      minimumValue={abvRange.min}
                      maximumValue={abvRange.max}
                      step={abvRange.step}
                      value={clampAbvToRange(effectiveAbv ?? defaultAbv ?? abvRange.min, abvRange)}
                      onValueChange={(v) => {
                        const clamped = clampAbvToRange(v, abvRange);
                        setAbvPercent(clamped);
                        setAbvInputText(String(clamped));
                      }}
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor={colors.border}
                      thumbTintColor={colors.primary}
                    />
                    <TextInput
                      style={styles.abvTextInput}
                      value={abvInputText}
                      onChangeText={(text) => {
                        setAbvInputText(text);
                        const n = parseFloat(String(text).replace(',', '.'));
                        if (
                          !Number.isNaN(n) &&
                          n >= abvRange.min &&
                          n <= abvRange.max
                        ) {
                          setAbvPercent(n);
                        }
                      }}
                      onBlur={() => {
                        const n = parseFloat(String(abvInputText).replace(',', '.'));
                        if (Number.isNaN(n)) {
                          const fallback = clampAbvToRange(defaultAbv ?? abvRange.min, abvRange);
                          setAbvPercent(fallback);
                          setAbvInputText(String(fallback));
                          return;
                        }
                        const clamped = clampAbvToRange(n, abvRange);
                        setAbvPercent(clamped);
                        setAbvInputText(String(clamped));
                      }}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                    <Text style={styles.abvUnit}>%</Text>
                  </View>
                  <Text style={styles.abvPreview}>
                    ≈{' '}
                    {calculateAlcoholMl(
                      selectedServing === SERVING_PROFILE_CUSTOM
                        ? parseVolumeInputToMl(
                            customVolumeRef.current ?? customVolume,
                            measurementSystem,
                            getVolumeUnitLabel(measurementSystem)
                          ) || 0
                        : servingProfiles.find((p) => p.id === selectedServing)?.volumeMl || 0,
                      effectiveAbv
                    ).toFixed(1)}{' '}
                    ml alcohol
                  </Text>
                </View>
              )}

              {(showCustomVolume || selectedServing === SERVING_PROFILE_CUSTOM) && (
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

      <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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
    </AppSheetLayout>
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
    minHeight: 0,
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
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  servingButton: {
    flex: 1,
    minWidth: 0,
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
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
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
  abvSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: BUTTON_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
  },
  abvLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  abvHelpText: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  abvInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  abvSlider: {
    flex: 1,
    height: 40,
  },
  abvTextInput: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    fontSize: typography.sizes.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  abvUnit: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  abvPreview: {
    fontSize: typography.sizes.small,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: typography.weights.medium,
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
  sheetBody: {
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  bottomActionBar: {
    paddingHorizontal: spacing.regular,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
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
