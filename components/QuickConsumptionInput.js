import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

const QuickConsumptionInput = ({ habit, value, onChange, unit, selectedDate, userId }) => {
  const consumptionEvents = value || [];

  const [consumptionOptions, setConsumptionOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Load consumption options on mount
  useEffect(() => {
    loadConsumptionOptions();
  }, [habit?.id]);

  const loadConsumptionOptions = async () => {
    if (!habit?.id) return;

    try {
      setLoadingOptions(true);
      // For now, just use some dummy options
      setConsumptionOptions([
        { id: '1', name: 'Espresso', drug_amount: 64, unit: 'mg', icon: 'cafe' },
        { id: '2', name: 'Coffee', drug_amount: 95, unit: 'mg', icon: 'cafe' },
        { id: '3', name: 'Beer', drug_amount: 14, unit: 'standard drinks', icon: 'beer' },
      ]);
    } catch (error) {
      console.error('Error loading options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleConsumptionPress = (option) => {
    // Simple logging for now
    console.log('Pressed:', option.name);
    // TODO: Add proper consumption logging
  };

  return (
    <View style={styles.container}>
      {/* Quick Consumption Buttons - compact horizontal layout */}
      <View style={styles.quickButtonsContainer}>
        {loadingOptions ? (
          <Text style={styles.loadingText}>Loading options...</Text>
        ) : (
          <>
            {consumptionOptions.slice(0, 6).map((option) => {
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.quickButton]}
                  onPress={() => handleConsumptionPress(option)}
                >
                  <Ionicons
                    name={option.icon || 'help-circle'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={styles.quickButtonText}
                    numberOfLines={1}
                  >
                    {option.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>+</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Consumption count indicator */}
      {consumptionEvents.length > 0 && (
        <Text style={styles.consumptionCount}>
          {consumptionEvents.length} logged today
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickButton: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickButtonText: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginTop: 2,
  },
  moreButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: typography.sizes.large,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  loadingText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  consumptionCount: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default QuickConsumptionInput;