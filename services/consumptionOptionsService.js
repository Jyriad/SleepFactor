import { supabase } from './supabase';
import { INTAKE_BASIS, isLiquidServingUnit } from '../utils/consumptionIntake';

/**
 * Service for managing consumption options (Beer, Wine, Espresso, etc.)
 * Handles CRUD operations for system defaults and user custom options.
 * Caches options per habit so the habit logging page and modals load quickly.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes – options change rarely

class ConsumptionOptionsService {
  constructor() {
    this._cache = new Map(); // habitId -> { data, timestamp }
  }

  _getCached(habitId) {
    const entry = this._cache.get(habitId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this._cache.delete(habitId);
      return null;
    }
    return entry.data;
  }

  _setCache(habitId, data) {
    this._cache.set(habitId, { data, timestamp: Date.now() });
  }

  _invalidate(habitId) {
    if (habitId) this._cache.delete(habitId);
  }

  /**
   * Return cached options for a habit if available (sync). Use so components can show options
   * immediately when cache was prefetched (e.g. from Home or Habit Logging load).
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

      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .eq('habit_id', habitId)
        .eq('is_active', true)
        .or('user_id.is.null,region.eq.custom')
        .order('is_custom', { ascending: false }) // Custom options first
        .order('name', { ascending: true });

      if (error) throw error;

      // Sort: None Today first, then alphabetically
      const sorted = (data || []).sort((a, b) => {
        if (a.name === 'None Today') return -1;
        if (b.name === 'None Today') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      this._setCache(habitId, sorted);
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
      this._invalidate(habitId);
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
        this._invalidateByOptionId(optionId);
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
      this._invalidateByOptionId(optionId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _invalidateByOptionId(optionId) {
    for (const [habitId, entry] of this._cache.entries()) {
      if (entry.data && entry.data.some(o => o.id === optionId)) {
        this._cache.delete(habitId);
        break;
      }
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
      this._invalidateByOptionId(optionId);
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

      const { error } = await supabase
        .from('consumption_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
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
      // First, try to find an existing option with this name
      const { data: existingOption } = await supabase
        .from('consumption_options')
        .select('id')
        .eq('habit_id', habitId)
        .eq('name', drinkTypeString)
        .eq('is_active', true)
        .single();

      if (existingOption) {
        return { success: true, optionId: existingOption.id };
      }

      // If no option exists, try to map legacy names to system defaults
      const legacyMappings = {
        // Caffeine
        'espresso': 'Espresso',
        'instant_coffee': 'Instant Coffee',
        'energy_drink': 'Energy Drink',
        'soft_drink': 'Soft Drink',
        // Alcohol
        'beer': 'Beer',
        'wine': 'Wine',
        'liquor': 'Liquor',
        'cocktail': 'Cocktail'
      };

      const mappedName = legacyMappings[drinkTypeString];
      if (mappedName) {
        const { data: systemOption } = await supabase
          .from('consumption_options')
          .select('id')
          .eq('habit_id', habitId)
          .eq('name', mappedName)
          .is('user_id', null)
          .eq('is_active', true)
          .single();

        if (systemOption) {
          return { success: true, optionId: systemOption.id };
        }
      }

      // If no mapping found, return null
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
      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .eq('habit_id', habitId)
        .is('user_id', null)
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
      let query = supabase
        .from('consumption_options')
        .select('id')
        .eq('habit_id', habitId)
        .eq('name', name.trim())
        .eq('is_active', true);

      if (excludeOptionId) {
        query = query.neq('id', excludeOptionId);
      }

      // Check against both system options (user_id IS NULL) and user's own options
      query = query.or(`user_id.is.null,user_id.eq.${userId}`);

      const { data, error } = await query.limit(1);

      if (error) throw error;

      return { success: true, available: data.length === 0 };
    } catch (error) {
      return { success: false, error: error.message, available: false };
    }
  }
}

const consumptionOptionsService = new ConsumptionOptionsService();
export default consumptionOptionsService;
