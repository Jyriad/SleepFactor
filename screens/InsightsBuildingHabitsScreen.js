import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import AppSheetLayout from '../components/AppSheetLayout';
import InsightHabitProgressBlock from '../components/InsightHabitProgressBlock';
import insightsService from '../services/insightsService';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

export default function InsightsBuildingHabitsScreen({ navigation }) {
  const habits = useMemo(() => insightsService.consumeStagingBuildingHabits(), []);

  const navigateToHabit = (habitId) => {
    if (!habitId) return;
    navigation.navigate('HabitTimeline', {
      habitId,
      metricKey: 'total_sleep_minutes',
      analysisMode: 'absolute',
    });
  };

  return (
    <AppSheetLayout
      title="Habit progress"
      subtitle="Which habits need more data or have no clear pattern yet"
      onDismiss={() => navigation.goBack()}
      nativePresentation
      scroll={false}
    >
      {habits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No habits in progress right now.</Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(item) => String(item.habitId)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isNeedsMore = item.status === 'needs_more';
            const n = item.timesLogged ?? 0;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigateToHabit(item.habitId)}
                activeOpacity={0.7}
              >
                <Text style={styles.habitName}>{item.habitName}</Text>
                {isNeedsMore ? (
                  <>
                    <Text style={styles.statusLabel}>Need more logs</Text>
                    <InsightHabitProgressBlock progress={item.progress} />
                  </>
                ) : (
                  <Text style={styles.statusLabel}>
                    No clear pattern yet ù Logged {n} time{n !== 1 ? 's' : ''} ù enough data, no strong
                    link yet
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </AppSheetLayout>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.regular,
    marginBottom: spacing.sm,
  },
  habitName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statusLabel: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  empty: {
    padding: spacing.regular,
  },
  emptyText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
