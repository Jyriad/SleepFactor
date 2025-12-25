import { supabase } from './supabase';

/**
 * Service for managing consumption options (Beer, Wine, Espresso, etc.)
 * Handles CRUD operations for system defaults and user custom options
 */

class ConsumptionOptionsService {
  /**
   * Get all active options for a specific habit
   * Returns both system defaults and user custom options
   */
  async getOptionsForHabit(habitId) {
    try {
      const { data, error } = await supabase
        .from('consumption_options')
        .select('*')
        .eq('habit_id', habitId)
        .eq('is_active', true)
        .order('is_custom', { ascending: false }) // Custom options first
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching consumption options:', error);
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
      console.error('Error fetching user consumption options:', error);
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
      console.error('Error fetching consumption option:', error);
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
        return { success: false, error: 'Volume must be between 1 and 10000 ml' };
      }

      // Auto-determine drug_unit based on habit type if not provided
      let finalDrugUnit = drugUnit;
      if (!finalDrugUnit) {
        const { data: habit } = await supabase
          .from('habits')
          .select('name')
          .eq('id', habitId)
          .single();

        if (habit) {
          const habitName = habit.name.toLowerCase();
          if (habitName.includes('caffeine')) {
            finalDrugUnit = 'mg';
          } else if (habitName.includes('alcohol')) {
            finalDrugUnit = 'ml';
          } else {
            finalDrugUnit = 'units';
          }
        }
      }

      const { data, error } = await supabase
        .from('consumption_options')
        .insert({
          user_id: userId,
          habit_id: habitId,
          name: name.trim(),
          drug_amount: drugAmount,
          icon: icon,
          volume_ml: volumeMl,
          serving_unit: servingUnit,
          drug_unit: finalDrugUnit,
          is_custom: true,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating consumption option:', error);
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
        return { success: false, error: 'Volume must be between 1 and 10000 ml' };
      }

      const updateData = {
        name: name.trim(),
        drug_amount: drugAmount,
        updated_at: new Date().toISOString()
      };

      // Only include fields that are not null
      if (icon !== null) updateData.icon = icon;
      if (volumeMl !== null) updateData.volume_ml = volumeMl;
      if (servingUnit !== null) updateData.serving_unit = servingUnit;
      if (drugUnit !== null) updateData.drug_unit = drugUnit;

      const { data, error } = await supabase
        .from('consumption_options')
        .update(updateData)
        .eq('id', optionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating consumption option:', error);
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
      return { success: true, data };
    } catch (error) {
      console.error('Error deleting consumption option:', error);
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
      console.error('Error hard deleting consumption option:', error);
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
      console.error('Error migrating legacy drink type:', error);
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
      console.error('Error fetching system consumption options:', error);
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
      console.error('Error fetching custom consumption options:', error);
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
      console.error('Error checking option name availability:', error);
      return { success: false, error: error.message, available: false };
    }
  }
}

const consumptionOptionsService = new ConsumptionOptionsService();
export default consumptionOptionsService;
