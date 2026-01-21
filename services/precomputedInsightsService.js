import { supabase } from './supabase';

/**
 * Service for fetching pre-computed insights from the server
 * This replaces on-device computation with server-side pre-computed insights
 */
class PrecomputedInsightsService {
  constructor() {
    this.INSIGHT_TYPES = {
      CORRELATION: 'correlation',
      BEDTIME_CONSISTENCY: 'bedtime_consistency'
    };
  }

  /**
   * Get all insights for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options { includeOldInsights: boolean }
   * @returns {Promise<Array>} Array of insight objects
   */
  async getUserInsights(userId, options = {}) {
    try {
      const { includeOldInsights = false } = options;

      // Query insights from the database
      let query = supabase
        .from('insights')
        .select(`
          *,
          habits (
            id,
            name,
            type,
            unit,
            is_custom
          )
        `)
        .eq('user_id', userId)
        .order('date_range_end', { ascending: false });

      // If we only want the latest insights, use the view
      if (!includeOldInsights) {
        query = supabase
          .from('latest_insights')
          .select(`
            *,
            habits (
              id,
              name,
              type,
              unit,
              is_custom
            )
          `)
          .eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching insights:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserInsights:', error);
      return [];
    }
  }

  /**
   * Get insights for a specific habit
   * @param {string} userId - User ID
   * @param {string} habitId - Habit ID
   * @returns {Promise<Array>} Array of insight objects for the habit
   */
  async getHabitInsights(userId, habitId) {
    try {
      const { data, error } = await supabase
        .from('latest_insights')
        .select(`
          *,
          habits (
            id,
            name,
            type,
            unit,
            is_custom
          )
        `)
        .eq('user_id', userId)
        .eq('habit_id', habitId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error in getHabitInsights:', error);
      return [];
    }
  }

  /**
   * Get bedtime consistency insight for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Bedtime consistency insight or null
   */
  async getBedtimeConsistencyInsight(userId) {
    try {
      const { data, error } = await supabase
        .from('latest_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('insight_type', this.INSIGHT_TYPES.BEDTIME_CONSISTENCY)
        .is('habit_id', null)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error in getBedtimeConsistencyInsight:', error);
      return null;
    }
  }

  /**
   * Transform server insights to match the format expected by the UI components
   * This maintains compatibility with existing UI components
   * @param {Array} serverInsights - Raw insights from database
   * @param {Array} allHabits - All user habits for reference
   * @returns {Object} Object with validInsights and placeholders arrays
   */
  transformServerInsightsToUIFormat(serverInsights, allHabits) {
    const validInsights = [];
    const placeholders = [];

    // Group insights by habit
    const insightsByHabit = {};
    const processedHabitIds = new Set();

    serverInsights.forEach(insight => {
      if (insight.habit_id) {
        if (!insightsByHabit[insight.habit_id]) {
          insightsByHabit[insight.habit_id] = [];
        }
        insightsByHabit[insight.habit_id].push(insight);
        processedHabitIds.add(insight.habit_id);
      } else if (insight.insight_type === this.INSIGHT_TYPES.BEDTIME_CONSISTENCY) {
        // Handle bedtime consistency as a user-level insight
        validInsights.push(this.transformBedtimeConsistencyInsight(insight));
      }
    });

    // Transform correlation insights for each habit
    Object.entries(insightsByHabit).forEach(([habitId, insights]) => {
      const habit = insights[0]?.habits;
      if (!habit) return;

      // Find correlation insights
      const correlationInsights = insights.filter(i => i.insight_type === this.INSIGHT_TYPES.CORRELATION);
      
      if (correlationInsights.length > 0) {
        // Transform based on habit type
        if (habit.type === 'binary') {
          const transformed = this.transformBinaryCorrelationInsight(correlationInsights[0]);
          if (transformed) {
            validInsights.push(transformed);
          }
        } else {
          const transformed = this.transformNumericalCorrelationInsight(correlationInsights[0]);
          if (transformed) {
            validInsights.push(transformed);
          }
        }
      }
    });

    // Create placeholders for habits without insights
    allHabits.forEach(habit => {
      if (!processedHabitIds.has(habit.id) && habit.is_active) {
        placeholders.push({
          habit,
          type: 'placeholder',
          totalDataPoints: 0,
          needsMoreData: true
        });
      }
    });

    return {
      validInsights,
      placeholders
    };
  }

  /**
   * Transform binary correlation insight to UI format
   * @param {Object} serverInsight - Server insight object
   * @returns {Object|null} UI-formatted insight
   */
  transformBinaryCorrelationInsight(serverInsight) {
    try {
      const { habits: habit, insight_data } = serverInsight;
      
      // Check if we have the necessary data
      if (!insight_data || !habit) return null;

      // For binary habits, we need yes/no statistics
      // The server stores correlation data, we need to transform it
      return {
        habit,
        type: 'binary',
        totalDataPoints: insight_data.data_points || 0,
        yesDataPoints: insight_data.yes_count || 0,
        noDataPoints: insight_data.no_count || 0,
        hasComparisonData: (insight_data.yes_count || 0) > 0 && (insight_data.no_count || 0) > 0,
        yesStats: insight_data.yes_stats || null,
        noStats: insight_data.no_stats || null,
        confidenceLevel: this.determineConfidenceLevel(insight_data)
      };
    } catch (error) {
      console.error('Error transforming binary insight:', error);
      return null;
    }
  }

  /**
   * Transform numerical correlation insight to UI format
   * @param {Object} serverInsight - Server insight object
   * @returns {Object|null} UI-formatted insight
   */
  transformNumericalCorrelationInsight(serverInsight) {
    try {
      const { habits: habit, insight_data } = serverInsight;
      
      if (!insight_data || !habit) return null;

      const correlation = insight_data.correlation || 0;

      return {
        habit,
        type: 'numerical',
        totalDataPoints: insight_data.data_points || 0,
        dataPoints: insight_data.scatter_points || [],
        correlation: correlation,
        correlationStrength: Math.abs(correlation) > 0.7 ? 'strong' :
                            Math.abs(correlation) > 0.3 ? 'moderate' : 'weak',
        trendDirection: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none',
        confidenceLevel: this.determineConfidenceLevel(insight_data)
      };
    } catch (error) {
      console.error('Error transforming numerical insight:', error);
      return null;
    }
  }

  /**
   * Transform bedtime consistency insight to UI format
   * @param {Object} serverInsight - Server insight object
   * @returns {Object} UI-formatted insight
   */
  transformBedtimeConsistencyInsight(serverInsight) {
    const { insight_data } = serverInsight;
    
    return {
      habit: {
        id: null,
        name: 'Bedtime Consistency',
        type: 'bedtime_consistency',
        is_custom: false
      },
      type: 'bedtime_consistency',
      consistencyScore: insight_data.consistency_score || 0,
      averageBedtimeMinutes: insight_data.average_bedtime_minutes || 0,
      dataPoints: insight_data.data_points || 0,
      totalNights: insight_data.total_nights || 0
    };
  }

  /**
   * Determine confidence level from insight data
   * @param {Object} insightData - Insight data object
   * @returns {string} Confidence level: 'high', 'medium', or 'low'
   */
  determineConfidenceLevel(insightData) {
    const n = insightData.data_points || 0;
    const correlation = Math.abs(insightData.correlation || 0);

    if (correlation > 0) {
      // For numerical habits
      if (n > 30 && correlation > 0.3) {
        return 'high';
      } else if (n > 20 && correlation > 0.2) {
        return 'medium';
      }
    } else {
      // For binary habits
      if (n >= 20) {
        return 'high';
      } else if (n >= 15) {
        return 'medium';
      }
    }
    
    return 'low';
  }

  /**
   * Request insight computation for the current user
   * This can be used to trigger on-demand computation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result of the computation request
   */
  async requestInsightComputation(userId) {
    try {
      // Call the compute-insights edge function
      const { data, error } = await supabase.functions.invoke('compute-insights', {
        body: { userId }
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error requesting insight computation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check the last insight computation status
   * @returns {Promise<Object|null>} Last computation status or null
   */
  async getLastComputationStatus() {
    try {
      const { data, error } = await supabase
        .from('last_insight_computation')
        .select('*')
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching computation status:', error);
      return null;
    }
  }

  /**
   * Get available sleep metrics (same as before for compatibility)
   * @returns {Array} Array of metric objects
   */
  getAvailableSleepMetrics() {
    return [
      { key: 'total_sleep_minutes', label: 'Total Sleep', unit: 'minutes' },
      { key: 'deep_sleep_minutes', label: 'Deep Sleep', unit: 'minutes' },
      { key: 'light_sleep_minutes', label: 'Light Sleep', unit: 'minutes' },
      { key: 'rem_sleep_minutes', label: 'REM Sleep', unit: 'minutes' },
      { key: 'awake_minutes', label: 'Awake Time', unit: 'minutes' },
      { key: 'awakenings_count', label: 'Awakenings', unit: 'count' },
      { key: 'sleep_score', label: 'Sleep Score', unit: 'score' }
    ];
  }

  /**
   * Get available time ranges (same as before for compatibility)
   * @returns {Array} Array of time range objects
   */
  getAvailableTimeRanges() {
    return [
      { key: 'all', label: 'All available data', days: null },
      { key: '30', label: 'Last 30 days', days: 30 },
      { key: '60', label: 'Last 60 days', days: 60 },
      { key: '90', label: 'Last 90 days', days: 90 },
      { key: '180', label: 'Last 180 days', days: 180 }
    ];
  }
}

export default new PrecomputedInsightsService();
