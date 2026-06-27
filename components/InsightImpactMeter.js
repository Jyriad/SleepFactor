import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fillFractionFromPercent } from '../utils/insightImpactDisplay';
import { colors, typography, spacing } from '../constants';

/** Fallback bar length when only impact tier is known (no insight payload). */
const FILL_FRACTION = {
  minimal: 0.28,
  small: 0.48,
  moderate: 0.68,
  large: 0.88,
};

const FALLBACK_PERCENT = {
  minimal: 15,
  small: 28,
  moderate: 42,
  large: 58,
};

const HURTS_COLOR = '#E8883A';
const HELPS_COLOR = colors.success;

function resolvePercentAndFill(impactPercent, impactLevel) {
  if (impactPercent != null && !isNaN(impactPercent)) {
    const pct = Math.round(Math.abs(impactPercent));
    return {
      pct,
      fraction: fillFractionFromPercent(pct),
    };
  }
  const level = impactLevel || 'minimal';
  return {
    pct: FALLBACK_PERCENT[level] ?? FALLBACK_PERCENT.minimal,
    fraction: FILL_FRACTION[level] ?? FILL_FRACTION.minimal,
  };
}

/**
 * Whoop-style impact meter: centred baseline, bar grows left (hurts) or right (helps).
 * Pass impactPercent from getInsightImpactDisplay() for data-driven label and bar length.
 */
export default function InsightImpactMeter({
  direction = 'positive',
  impactLevel = 'minimal',
  impactPercent = null,
  layout = 'full',
  showLegend = false,
  showValue = true,
  legendOnly = false,
  style,
}) {
  const helps = direction !== 'negative';
  const hurts = direction === 'negative';
  const { pct, fraction } = resolvePercentAndFill(impactPercent, impactLevel);
  const valueLabel = helps ? `+${pct}%` : `-${pct}%`;
  const barHeight = layout === 'full' ? 10 : 8;

  if (legendOnly) {
    return (
      <View style={[styles.root, style]}>
        <View style={styles.legendRow}>
          <View style={styles.legendSide}>
            <Ionicons name="arrow-down" size={11} color={HURTS_COLOR} />
            <Text style={[styles.legendText, styles.legendHurts]}>Hurts</Text>
          </View>
          <Text style={styles.legendCenter}>Impact</Text>
          <View style={[styles.legendSide, styles.legendSideRight]}>
            <Text style={[styles.legendText, styles.legendHelps]}>Helps</Text>
            <Ionicons name="arrow-up" size={11} color={HELPS_COLOR} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, layout === 'full' && styles.rootFull, style]}
      accessibilityRole="text"
      accessibilityLabel={
        helps
          ? `Helps your sleep, about ${pct} percent`
          : `May hurt your sleep, about ${pct} percent`
      }
    >
      {showLegend ? (
        <View style={styles.legendRow}>
          <View style={styles.legendSide}>
            <Ionicons name="arrow-down" size={11} color={HURTS_COLOR} />
            <Text style={[styles.legendText, styles.legendHurts]}>Hurts</Text>
          </View>
          <Text style={styles.legendCenter}>Impact</Text>
          <View style={[styles.legendSide, styles.legendSideRight]}>
            <Text style={[styles.legendText, styles.legendHelps]}>Helps</Text>
            <Ionicons name="arrow-up" size={11} color={HELPS_COLOR} />
          </View>
        </View>
      ) : null}

      <View style={styles.meterRow}>
        <View style={[styles.trackShell, layout === 'inline' && styles.trackInline]}>
          <View style={styles.trackRow}>
            <View style={[styles.halfShell, styles.halfShellLeft]}>
              {hurts ? (
                <View
                  style={[
                    styles.bar,
                    styles.barHurts,
                    {
                      width: `${fraction * 100}%`,
                      height: barHeight,
                      borderTopRightRadius: barHeight / 2,
                      borderBottomRightRadius: barHeight / 2,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View
              style={[
                styles.centerDot,
                {
                  width: barHeight + 4,
                  height: barHeight + 4,
                  borderRadius: (barHeight + 4) / 2,
                  marginTop: -1,
                },
              ]}
            />

            <View style={[styles.halfShell, styles.halfShellRight]}>
              {helps ? (
                <View
                  style={[
                    styles.bar,
                    styles.barHelps,
                    {
                      width: `${fraction * 100}%`,
                      height: barHeight,
                      borderTopLeftRadius: barHeight / 2,
                      borderBottomLeftRadius: barHeight / 2,
                    },
                  ]}
                />
              ) : null}
            </View>
          </View>
        </View>

        {showValue ? (
          <Text
            style={[
              styles.valueLabel,
              helps ? styles.valueHelps : styles.valueHurts,
              layout === 'inline' && styles.valueInline,
            ]}
          >
            {valueLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  rootFull: {
    marginTop: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  legendSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  legendSideRight: {
    justifyContent: 'flex-end',
  },
  legendText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  legendHurts: {
    color: HURTS_COLOR,
  },
  legendHelps: {
    color: HELPS_COLOR,
  },
  legendCenter: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    flex: 1,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trackShell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  trackInline: {
    flex: 0,
    width: 140,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 18,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  halfShell: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 10,
  },
  halfShellLeft: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(232, 136, 58, 0.1)',
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  halfShellRight: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  centerDot: {
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    zIndex: 2,
    marginHorizontal: -1,
  },
  bar: {
    minWidth: 4,
  },
  barHurts: {
    backgroundColor: HURTS_COLOR,
  },
  barHelps: {
    backgroundColor: HELPS_COLOR,
  },
  valueLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.bold,
    minWidth: 44,
    textAlign: 'right',
  },
  valueInline: {
    minWidth: 40,
    fontSize: typography.sizes.xs,
  },
  valueHelps: {
    color: HELPS_COLOR,
  },
  valueHurts: {
    color: HURTS_COLOR,
  },
});
