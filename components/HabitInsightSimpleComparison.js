import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../constants';

function formatValue(metricKey, value) {
  if (value == null || isNaN(value)) return '—';
  if (metricKey === 'awakenings_count') return `${Math.round(value)}`;
  if (
    metricKey === 'tiredness_score' ||
    metricKey === 'dream_vividness_score' ||
    (typeof metricKey === 'string' && metricKey.startsWith('subj_'))
  ) {
    return `${Math.round(value * 10) / 10}`;
  }
  const mins = Math.round(value);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

function numericBarLabels(habit) {
  const name = habit?.name || 'this habit';
  if (habit?.type === 'time') {
    return {
      low: 'Closer to bedtime',
      high: 'Earlier before bed',
      lowCaption: `Later ${name.toLowerCase()}`,
      highCaption: `Earlier ${name.toLowerCase()}`,
    };
  }
  return {
    low: `Less ${name.toLowerCase()}`,
    high: `More ${name.toLowerCase()}`,
    lowCaption: `Lower ${name.toLowerCase()}`,
    highCaption: `Higher ${name.toLowerCase()}`,
  };
}

/**
 * Simple two-bar comparison for habit detail (with vs without / high vs low).
 */
export default function HabitInsightSimpleComparison({ insight, sleepMetric }) {
  if (!insight || !sleepMetric) return null;

  const metricKey = sleepMetric.key;
  const metricLabel = sleepMetric.label || 'Sleep';

  if (insight.type === 'binary' && insight.yesStats && insight.noStats) {
    const yesVal = insight.yesStats.median;
    const noVal = insight.noStats.median;
    const maxVal = Math.max(yesVal || 0, noVal || 0, 1);

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Typical night</Text>
        <BarRow
          label={`When you do "${insight.habit?.name || 'habit'}"`}
          value={formatValue(metricKey, yesVal)}
          widthPct={(yesVal / maxVal) * 100}
          accent
        />
        <BarRow
          label="When you don't"
          value={formatValue(metricKey, noVal)}
          widthPct={(noVal / maxVal) * 100}
        />
        <Text style={styles.caption}>
          Median {metricLabel.toLowerCase()} · {insight.yesDataPoints ?? 0} yes nights ·{' '}
          {insight.noDataPoints ?? 0} no nights
        </Text>
      </View>
    );
  }

  if (insight.type === 'numerical' && insight.dataPoints?.length >= 2) {
    const points = insight.dataPoints
      .map((p) => ({
        x: p.x ?? p.habitValue,
        y: p.y ?? p.sleepValue,
      }))
      .filter((p) => p.x != null && p.y != null);
    const xs = points.map((p) => p.x).sort((a, b) => a - b);
    const medianX = xs[Math.floor(xs.length / 2)];
    const lowY = [];
    const highY = [];
    points.forEach((p) => {
      if (p.x <= medianX) lowY.push(p.y);
      else highY.push(p.y);
    });
    const med = (arr) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const lowMed = lowY.length ? med(lowY) : null;
    const highMed = highY.length ? med(highY) : null;
    if (lowMed == null || highMed == null) return null;
    const maxVal = Math.max(lowMed, highMed, 1);
    const labels = numericBarLabels(insight.habit);

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Typical night</Text>
        <BarRow
          label={labels.low}
          value={formatValue(metricKey, lowMed)}
          widthPct={(lowMed / maxVal) * 100}
        />
        <BarRow
          label={labels.high}
          value={formatValue(metricKey, highMed)}
          widthPct={(highMed / maxVal) * 100}
          accent
        />
        <Text style={styles.caption}>
          Median {metricLabel.toLowerCase()} · {insight.totalDataPoints ?? points.length} paired
          nights · comparing {labels.lowCaption} vs {labels.highCaption}
        </Text>
      </View>
    );
  }

  return null;
}

function BarRow({ label, value, widthPct, accent = false }) {
  return (
    <View style={styles.barBlock}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            accent && styles.barFillAccent,
            { width: `${Math.min(100, Math.max(8, widthPct))}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    padding: spacing.regular,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  barBlock: {
    marginBottom: spacing.sm,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  barLabel: {
    flex: 1,
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  barValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.textSecondary,
    opacity: 0.45,
  },
  barFillAccent: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  caption: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
