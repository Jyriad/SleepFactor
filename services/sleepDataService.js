import { supabase } from './supabase';

/**
 * Sleep data service for Supabase operations
 */
class SleepDataService {
  constructor() {
    this.tableName = 'sleep_data';
  }

  /**
   * Upsert sleep data (insert or update if exists)
   * @param {Object} sleepData - Sleep data object
   * @param {string} sleepData.date - Date in YYYY-MM-DD format
   * @param {number} sleepData.total_sleep_minutes - Total sleep time in minutes
   * @param {number} sleepData.deep_sleep_minutes - Deep sleep time in minutes
   * @param {number} sleepData.light_sleep_minutes - Light sleep time in minutes
   * @param {number} sleepData.rem_sleep_minutes - REM sleep time in minutes
   * @param {number} sleepData.awake_minutes - Awake time in minutes
   * @param {number} sleepData.awakenings_count - Number of awakenings
   * @param {number|null} sleepData.sleep_score - Sleep score (0-100) or null
   * @param {string} sleepData.source - Data source ('health_connect', 'healthkit', or 'manual')
   * @returns {Promise<Object>} The upserted record
   */
  async upsertSleepData(sleepData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const record = {
        user_id: user.id,
        date: sleepData.date,
        total_sleep_minutes: sleepData.total_sleep_minutes || 0,
        deep_sleep_minutes: sleepData.deep_sleep_minutes || 0,
        light_sleep_minutes: sleepData.light_sleep_minutes || 0,
        rem_sleep_minutes: sleepData.rem_sleep_minutes || 0,
        awake_minutes: sleepData.awake_minutes || 0,
        awakenings_count: sleepData.awakenings_count || 0,
        sleep_score: sleepData.sleep_score,
        source: sleepData.source,
        updated_at: new Date().toISOString(),
      };

      // Only include sleep_stages if it's provided and not null
      // This allows the code to work before the migration is run
      // Also ensure it's a valid array before including it
      if (sleepData.sleep_stages !== undefined && 
          sleepData.sleep_stages !== null && 
          Array.isArray(sleepData.sleep_stages) &&
          sleepData.sleep_stages.length > 0) {
        // Validate and clean the sleep_stages data
        const validStages = sleepData.sleep_stages
          .filter(stage => stage && stage.stage && stage.startTime && stage.endTime)
          .map(stage => ({
            stage: stage.stage.trim(), // Remove any whitespace
            startTime: stage.startTime,
            endTime: stage.endTime,
            durationMinutes: stage.durationMinutes || 0,
          }));
        
        if (validStages.length > 0) {
          record.sleep_stages = validStages;
        }
      }

      let { data, error } = await supabase
        .from(this.tableName)
        .upsert(record, {
          onConflict: 'user_id,date',
          ignoreDuplicates: false
        })
        .select()
        .single();

      // If error is about unknown column (sleep_stages doesn't exist yet), retry without it
      if (error && (
        error.message?.includes('column') && error.message?.includes('does not exist') ||
        error.message?.includes('sleep_stages') ||
        error.code === '42703' // PostgreSQL undefined_column error code
      )) {
        console.warn('⚠️ sleep_stages column not found, retrying without it');
        // Remove sleep_stages and retry
        const { sleep_stages, ...recordWithoutStages } = record;
        const retryResult = await supabase
          .from(this.tableName)
          .upsert(recordWithoutStages, {
            onConflict: 'user_id,date',
            ignoreDuplicates: false
          })
          .select()
          .single();
        
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to upsert sleep data:', error);
      throw error;
    }
  }

  /**
   * Get sleep data for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Sleep data record or null if not found
   */
  async getSleepDataForDate(date) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('updated_at', { ascending: false }) // Get most recent first
        .limit(1); // Take only the most recent record

      if (error) {
        throw error;
      }

      // Return the first (most recent) record, or null if no records
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Failed to get sleep data for date:', error);
      throw error;
    }
  }

  /**
   * Get sleep data for a date range
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of sleep data records
   */
  async getSleepDataForRange(startDate, endDate) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get sleep data for range:', error);
      throw error;
    }
  }

  /**
   * Delete sleep data for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSleepDataForDate(date) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .select();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to delete sleep data for date:', error);
      throw error;
    }
  }

  /**
   * Delete all sleep data for the current user
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteAllSleepData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', user.id)
        .select('id', { count: 'exact' });

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      console.log(`Deleted ${deletedCount} sleep data records`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete all sleep data:', error);
      throw error;
    }
  }

  /**
   * Delete all habit logs for the current user
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteAllHabitLogs() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', user.id)
        .select('id', { count: 'exact' });

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      console.log(`Deleted ${deletedCount} habit log records`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete all habit logs:', error);
      throw error;
    }
  }

  /**
   * Get the latest sleep data record
   * @returns {Promise<Object|null>} Latest sleep data record or null
   */
  async getLatestSleepData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Failed to get latest sleep data:', error);
      throw error;
    }
  }

  /**
   * Get sleep data summary for analytics
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Summary statistics
   */
  async getSleepDataSummary(days = 30) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateString = startDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateString);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalRecords: 0,
          averageSleepMinutes: 0,
          averageDeepSleepMinutes: 0,
          averageSleepScore: null,
          dateRange: { start: startDateString, end: new Date().toISOString().split('T')[0] }
        };
      }

      const validSleepScores = data.filter(record => record.sleep_score !== null);
      const averageSleepMinutes = Math.round(
        data.reduce((sum, record) => sum + record.total_sleep_minutes, 0) / data.length
      );
      const averageDeepSleepMinutes = Math.round(
        data.reduce((sum, record) => sum + record.deep_sleep_minutes, 0) / data.length
      );
      const averageSleepScore = validSleepScores.length > 0
        ? Math.round(validSleepScores.reduce((sum, record) => sum + record.sleep_score, 0) / validSleepScores.length)
        : null;

      return {
        totalRecords: data.length,
        averageSleepMinutes,
        averageDeepSleepMinutes,
        averageSleepScore,
        dateRange: { start: startDateString, end: new Date().toISOString().split('T')[0] }
      };
    } catch (error) {
      console.error('Failed to get sleep data summary:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new SleepDataService();
