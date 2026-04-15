import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { INTAKE_BASIS, isLiquidServingUnit } from '../utils/consumptionIntake';
import { presetScopeFromHabitName } from '../utils/consumptionPresetScope';

/**
 * Service for managing consumption options (Beer, Wine, Espresso, etc.)
 * Handles CRUD operations for system defaults and user custom options.
 * Caches options per habit (memory + AsyncStorage, 30-day TTL) so logging opens quickly;
 * cache is cleared when the user edits custom options or signs out.
 */

/** In-memory + on-device cache TTL — options change rarely (often never after first load). */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** AsyncStorage key prefix; bump version if stored shape changes. */
export const CONSUMPTION_OPTIONS_DISK_KEY_PREFIX = 'consumption_options_cache_v1:';

function diskKeyForHabit(habitId) {
  return `${CONSUMPTION_OPTIONS_DISK_KEY_PREFIX}${habitId}`;
}

/**
 * Remove all persisted consumption-option caches (call on sign-out).
 */
export async function clearConsumptionOptionsDiskCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => k.startsWith(CONSUMPTION_OPTIONS_DISK_KEY_PREFIX));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (_e) {
    /* non-fatal */
  }
}

class ConsumptionOptionsService {
  constructor() {
    this._cache = new Map(); // habitId -> { data, savedAt }
  }

  _getCached(habitId) {
    const entry = this._cache.get(habitId);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      this._cache.delete(habitId);
      return null;
    }
    return entry.data;
  }

  _setMemoryCache(habitId, data, savedAt = Date.now()) {
    this._cache.set(habitId, { data, savedAt });
  }

  async _readDiskCache(habitId) {
    try {
      const raw = await AsyncStorage.getItem(diskKeyForHabit(habitId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : null;
      const data = parsed?.data;
      if (savedAt == null || !Array.isArray(data)) return null;
      if (Date.now() - savedAt > CACHE_TTL_MS) {
        await AsyncStorage.removeItem(diskKeyForHabit(habitId));
        return null;
      }
      return { data, savedAt };
    } catch (_e) {
      return null;
    }
  }

  async _writeDiskCache(habitId, data) {
    try {
      const savedAt = Date.now();
      await AsyncStorage.setItem(
        diskKeyForHabit(habitId),
        JSON.stringify({ v: 1, savedAt, data })
      );
      return savedAt;
    } catch (_e) {
      await this._deleteDiskCache(habitId);
      return null;
    }
  }

  async _deleteDiskCache(habitId) {
    if (!habitId) return;
    try {
      await AsyncStorage.removeItem(diskKeyForHabit(habitId));
    } catch (_e) {
      /* non-fatal */
    }
  }

  async _setCache(habitId, data) {
    const savedAt = (await this._writeDiskCache(habitId, data)) ?? Date.now();
    this._setMemoryCache(habitId, data, savedAt);
  }

  async _invalidate(habitId) {
    if (!habitId) return;
    this._cache.delete(habitId);
    await this._deleteDiskCache(habitId);
  }

  async _presetScopeForHabitId(habitId) {
    const { data, error } = await supabase
      .from('habits')
      .select('name')
      .eq('id', habitId)
      .maybeSingle();
    if (error) throw error;
    return presetScopeFromHabitName(data?.name);
  }

  _mergeAndSortOptions(rows) {
    const byId = new Map();
    (rows || []).forEach((row) => {
      if (row?.id) byId.set(row.id, row);
    });
    const data = Array.from(byId.values());
    return data.sort((a, b) => {
      if (a.is_custom !== b.is_custom) return a.is_custom ? -1 : 1;
      if (a.name === 'None Today') return -1;
      if (b.name === 'None Today') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  /**
   * Return cached options for a habit if available (sync, in-memory only). After a cold start,
   * the first `getOptionsForHabit` hydrates memory from disk so later reads are instant.
   * @param {string} habitId - Habit UUID
   * @returns {Array|null} Cached options array or null if not cached / expired
   */
  getCachedOptions(habitId) {
    return this._getCached(habitId);
  }

  /**
   * Get all active options for a specific habit.
   * Returns cached data when available to avoid lag on the habit logging page.
   * @param {string} habitId - Habit UUID
   * @param {string} _region - Deprecated; kept for API compatibility. No longer filters DB.
   */
  async getOptionsForHabit(habitId, _region = 'metric') {
    try {
      const cached = this._getCached(habitId);
      if (cached) {
        return { success: true, data: cached };
      }

      const fromDisk = await this._readDiskCache(habitId);
      if (fromDisk && Array.isArray(fromDisk.data)) {
        this._setMemoryCache(habitId, fromDisk.data, fromDisk.savedAt);
        return { success: true, data: fromDisk.data };
      }

      const presetScope = await this._presetScopeForHabitId(habitId);
      const queries = [];

      if (presetScope) {
        queries.push(
          supabase
            .from('consumption_options')
            .select('*')
            .is('user_id', null)
            .eq('preset_scope', presetScope)
            .eq('is_active', true)
        );
      }

      queries.push(
        supabase
          .from('consumption_options')
          .select('*')
          .eq('habit_id', habitId)
          .not('user_id', 'is', null)
          .eq('is_active', true)
      );

      const results = await Promise.all(queries);
      for (const r of results) {
        if (r.error) throw r.error;
      }

      const merged = results.flatMap((r) => r.data || []);
      const sorted = this._mergeAndSortOptions(merged);

      await this._setCache(habitId, sorted);
      return { success: true, data: sorted };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all options for a user (both system and custom)
   */
  async getUserOptions(userId) {
    try {
      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .eq('is_active', true)
        .order('is_custom', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single option by ID
   */
  async getOptionById(optionId) {
    try {
      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .eq('id', optionId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new custom option for a user
   */
  async createCustomOption(userId, habitId, name, drugAmount, icon = null, volumeMl = null, servingUnit = 'ml', drugUnit = null) {
    try {
      // Validate inputs
      if (!userId || !habitId || !name || !drugAmount) {
        return { success: false, error: 'All fields are required' };
      }

      if (drugAmount <= 0) {
        return { success: false, error: 'Drug amount must be greater than 0' };
      }

      if (volumeMl !== null && (volumeMl <= 0 || volumeMl > 10000)) {
        return { success: false, error: 'Reference size must be between 1 and 10000' };
      }

      const { data: habit } = await supabase
        .from('habits')
        .select('name')
        .eq('id', habitId)
        .single();

      let finalDrugUnit = drugUnit;
      if (!finalDrugUnit && habit?.name) {
        const habitName = habit.name.toLowerCase();
        if (habitName.includes('caffeine')) {
          finalDrugUnit = 'mg';
        } else if (habitName.includes('alcohol')) {
          finalDrugUnit = 'ml';
        } else {
          finalDrugUnit = 'units';
        }
      }

      const habitNameLower = (habit?.name || '').toLowerCase();
      const isAlcoholHabit = habitNameLower.includes('alcohol');
      const liquid = isAlcoholHabit || isLiquidServingUnit(servingUnit);
      let intakeBasis = INTAKE_BASIS.VOLUME_ML;
      let referenceVolumeMl = null;
      let referenceServingCount = null;
      let defaultVolumeRow = null;
      if (isAlcoholHabit) {
        referenceVolumeMl = volumeMl;
        defaultVolumeRow = volumeMl;
      } else if (liquid) {
        referenceVolumeMl = volumeMl != null && volumeMl > 0 ? volumeMl : null;
        defaultVolumeRow = volumeMl != null && volumeMl > 0 ? Math.round(volumeMl) : null;
      } else {
        intakeBasis = INTAKE_BASIS.SERVING_COUNT;
        const cnt = volumeMl != null && volumeMl > 0 ? Number(volumeMl) : 1;
        referenceServingCount = Math.max(cnt, 0.001);
        defaultVolumeRow = referenceServingCount;
      }

      const { data, error } = await supabase
        .from('consumption_options')
        .insert({
          user_id: userId,
          habit_id: habitId,
          name: name.trim(),
          drug_amount: drugAmount,
          icon: icon,
          default_volume: defaultVolumeRow,
          serving_unit: servingUnit,
          drug_unit: finalDrugUnit,
          intake_basis: intakeBasis,
          reference_volume_ml: referenceVolumeMl,
          reference_serving_count: referenceServingCount,
          is_custom: true,
          is_active: true,
          region: 'custom'
        })
        .select()
        .single();

      if (error) throw error;
      await this._invalidate(habitId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing custom option
   */
  async updateCustomOption(optionId, name, drugAmount, icon = null, volumeMl = null, servingUnit = null, drugUnit = null) {
    try {
      // Validate inputs
      if (!optionId || !name || !drugAmount) {
        return { success: false, error: 'All fields are required' };
      }

      if (drugAmount <= 0) {
        return { success: false, error: 'Drug amount must be greater than 0' };
      }

      if (volumeMl !== null && (volumeMl <= 0 || volumeMl > 10000)) {
        return { success: false, error: 'Reference size must be between 1 and 10000' };
      }

      const baseUpdate = {
        name: name.trim(),
        drug_amount: drugAmount,
        updated_at: new Date().toISOString(),
      };
      if (icon !== null) baseUpdate.icon = icon;
      if (drugUnit !== null) baseUpdate.drug_unit = drugUnit;

      if (volumeMl === null && servingUnit === null) {
        const { data, error } = await supabase
          .from('consumption_options')
          .update(baseUpdate)
          .eq('id', optionId)
          .select()
          .single();

        if (error) throw error;
        if (data?.habit_id) await this._invalidate(data.habit_id);
        return { success: true, data };
      }

      const { data: existingOpt, error: exErr } = await supabase
        .from('consumption_options')
        .select('habit_id, serving_unit, default_volume, reference_volume_ml, reference_serving_count')
        .eq('id', optionId)
        .single();
      if (exErr) throw exErr;

      const { data: habitForOpt } = await supabase
        .from('habits')
        .select('name')
        .eq('id', existingOpt.habit_id)
        .maybeSingle();

      const effUnit = servingUnit !== null ? servingUnit : existingOpt.serving_unit;
      const isAlcoholHabit = (habitForOpt?.name || '').toLowerCase().includes('alcohol');
      const liquid = isAlcoholHabit || isLiquidServingUnit(effUnit);

      let effNumeric = volumeMl;
      if (effNumeric === null) {
        if (liquid) {
          effNumeric =
            existingOpt.reference_volume_ml != null && Number(existingOpt.reference_volume_ml) > 0
              ? Number(existingOpt.reference_volume_ml)
              : existingOpt.default_volume != null && Number(existingOpt.default_volume) > 0
                ? Number(existingOpt.default_volume)
                : null;
        } else {
          effNumeric =
            existingOpt.reference_serving_count != null && Number(existingOpt.reference_serving_count) > 0
              ? Number(existingOpt.reference_serving_count)
              : existingOpt.default_volume != null && Number(existingOpt.default_volume) > 0
                ? Number(existingOpt.default_volume)
                : 1;
        }
      }

      let intakeBasis = INTAKE_BASIS.VOLUME_ML;
      let referenceVolumeMl = null;
      let referenceServingCount = null;
      let defaultVolumeRow = null;
      if (isAlcoholHabit) {
        referenceVolumeMl = effNumeric;
        defaultVolumeRow = effNumeric;
      } else if (liquid) {
        referenceVolumeMl = effNumeric != null && effNumeric > 0 ? effNumeric : null;
        defaultVolumeRow = effNumeric != null && effNumeric > 0 ? Math.round(effNumeric) : null;
      } else {
        intakeBasis = INTAKE_BASIS.SERVING_COUNT;
        const cnt = effNumeric != null && effNumeric > 0 ? Number(effNumeric) : 1;
        referenceServingCount = Math.max(cnt, 0.001);
        defaultVolumeRow = referenceServingCount;
      }

      const updateData = {
        ...baseUpdate,
        intake_basis: intakeBasis,
        reference_volume_ml: referenceVolumeMl,
        reference_serving_count: referenceServingCount,
        default_volume: defaultVolumeRow,
      };
      if (servingUnit !== null) updateData.serving_unit = servingUnit;

      const { data, error } = await supabase
        .from('consumption_options')
        .update(updateData)
        .eq('id', optionId)
        .select()
        .single();

      if (error) throw error;
      if (data?.habit_id) await this._invalidate(data.habit_id);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Soft delete a custom option (mark as inactive)
   */
  async deleteCustomOption(optionId) {
    try {
      if (!optionId) {
        return { success: false, error: 'Option ID is required' };
      }

      // Soft delete by marking as inactive
      const { data, error } = await supabase
        .from('consumption_options')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', optionId)
        .select()
        .single();

      if (error) throw error;
      if (data?.habit_id) await this._invalidate(data.habit_id);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Hard delete a custom option (permanent deletion)
   * Use with caution - this will break existing consumption events
   */
  async hardDeleteCustomOption(optionId) {
    try {
      if (!optionId) {
        return { success: false, error: 'Option ID is required' };
      }

      const { data: row, error: selErr } = await supabase
        .from('consumption_options')
        .select('habit_id')
        .eq('id', optionId)
        .maybeSingle();
      if (selErr) throw selErr;

      const { error } = await supabase
        .from('consumption_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
      if (row?.habit_id) await this._invalidate(row.habit_id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Migrate legacy drink_type string values to option IDs
   * Used for backward compatibility with existing consumption events
   */
  async migrateLegacyDrinkType(drinkTypeString, habitId) {
    try {
      const { data: existingOption } = await supabase
        .from('consumption_options')
        .select('id')
        .eq('habit_id', habitId)
        .eq('name', drinkTypeString)
        .eq('is_active', true)
        .maybeSingle();

      if (existingOption) {
        return { success: true, optionId: existingOption.id };
      }

      const legacyMappings = {
        'espresso': 'Espresso',
        'instant_coffee': 'Instant Coffee',
        'energy_drink': 'Energy Drink',
        'soft_drink': 'Soft Drink',
        'beer': 'Beer',
        'wine': 'Wine',
        'liquor': 'Liquor',
        'cocktail': 'Cocktail'
      };

      const mappedName = legacyMappings[drinkTypeString];
      if (mappedName) {
        const presetScope = await this._presetScopeForHabitId(habitId);
        if (presetScope) {
          const { data: systemOption } = await supabase
            .from('consumption_options')
            .select('id')
            .is('user_id', null)
            .eq('preset_scope', presetScope)
            .eq('name', mappedName)
            .eq('is_active', true)
            .maybeSingle();

          if (systemOption) {
            return { success: true, optionId: systemOption.id };
          }
        }
      }

      return { success: false, error: `No matching option found for legacy drink type: ${drinkTypeString}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get system default options for a habit
   */
  async getSystemOptionsForHabit(habitId) {
    try {
      const presetScope = await this._presetScopeForHabitId(habitId);
      if (!presetScope) {
        return { success: true, data: [] };
      }
      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .is('user_id', null)
        .eq('preset_scope', presetScope)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get custom options created by a specific user
   */
  async getCustomOptionsForUser(userId, habitId = null) {
    try {
      let query = supabase
        .from('consumption_options')
        .select('*')
        .eq('user_id', userId)
        .eq('is_custom', true)
        .eq('is_active', true);

      if (habitId) {
        query = query.eq('habit_id', habitId);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if an option name is available for a user and habit
   */
  async isOptionNameAvailable(userId, habitId, name, excludeOptionId = null) {
    try {
      const trimmed = name.trim();
      const presetScope = await this._presetScopeForHabitId(habitId);

      if (presetScope) {
        let sysQ = supabase
          .from('consumption_options')
          .select('id')
          .is('user_id', null)
          .eq('preset_scope', presetScope)
          .eq('name', trimmed)
          .eq('is_active', true);
        if (excludeOptionId) sysQ = sysQ.neq('id', excludeOptionId);
        const { data: sysRows, error: sysErr } = await sysQ.limit(1);
        if (sysErr) throw sysErr;
        if (sysRows && sysRows.length > 0) {
          return { success: true, available: false };
        }
      }

      let customQ = supabase
        .from('consumption_options')
        .select('id')
        .eq('habit_id', habitId)
        .eq('user_id', userId)
        .eq('name', trimmed)
        .eq('is_active', true);
      if (excludeOptionId) customQ = customQ.neq('id', excludeOptionId);
      const { data: customRows, error: customErr } = await customQ.limit(1);
      if (customErr) throw customErr;

      return { success: true, available: !customRows || customRows.length === 0 };
    } catch (error) {
      return { success: false, error: error.message, available: false };
    }
  }
}

const consumptionOptionsService = new ConsumptionOptionsService();
export default consumptionOptionsService;
