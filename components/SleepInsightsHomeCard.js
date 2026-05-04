import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { typography, spacing } from '../constants';

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build plain / habit-bold / directional color segments for the home insight line.
 */
function buildHeadlineParts(headline, habitName, impactDirection) {
  if (!headline || typeof headline !== 'string') return [{ type: 'plain', text: '' }];
  const dirColor =
    impactDirection === 'negative' ? colors.error : colors.success;
  /** @type {{ start: number, end: number, kind: string }[]} */
  const matches = [];

  const trimmedHabit = (habitName || '').trim();
  if (trimmedHabit.length > 0) {
    try {
      const reHabit = new RegExp(escapeRegExp(trimmedHabit), 'gi');
      let m;
      while ((m = reHabit.exec(headline)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, kind: 'habit' });
      }
    } catch (_e) {
      /* ignore bad pattern */
    }
  }

  const reDir = /\b(higher|lower|more|less|fewer)\b/gi;
  let md;
  while ((md = reDir.exec(headline)) !== null) {
    const word = headline.slice(md.index, md.index + md[0].length);
    if (/^more$/i.test(word) && /^more personalized\b/i.test(headline.slice(md.index))) continue;
    matches.push({ start: md.index, end: md.index + md[0].length, kind: 'dir' });
  }

  matches.sort((a, b) => a.start - b.start);
  const kept = [];
  for (const span of matches) {
    if (kept.some((k) => span.start < k.end && span.end > k.start)) continue;
    kept.push(span);
  }
  kept.sort((a, b) => a.start - b.start);

  /** @type {{ type: string, text: string, color?: string }[]} */
  const parts = [];
  let i = 0;
  for (const sp of kept) {
    if (sp.start > i) {
      parts.push({ type: 'plain', text: headline.slice(i, sp.start) });
    }
    const slice = headline.slice(sp.start, sp.end);
    if (sp.kind === 'habit') {
      parts.push({ type: 'habit', text: slice });
    } else {
      parts.push({ type: 'dir', text: slice, color: dirColor });
    }
    i = sp.end;
  }
  if (i < headline.length) {
    parts.push({ type: 'plain', text: headline.slice(i) });
  }
  return parts.length ? parts : [{ type: 'plain', text: headline }];
}

function HomeInsightHeadline({ headline, habitName, impactDirection }) {
  const parts = useMemo(
    () => buildHeadlineParts(headline, habitName, impactDirection),
    [headline, habitName, impactDirection]
  );

  return (
    <Text style={styles.headline} numberOfLines={5}>
      {parts.map((p, idx) => {
        if (p.type === 'habit') {
          return (
            <Text key={idx} style={styles.headlineHabit}>
              {p.text}
            </Text>
          );
        }
        if (p.type === 'dir') {
          return (
            <Text key={idx} style={[styles.headlineDirWord, { color: p.color }]}>
              {p.text}
            </Text>
          );
        }
        return <Text key={idx}>{p.text}</Text>;
      })}
    </Text>
  );
}

/**
 * Home card: one row per sleep metric with a headline for the strongest habit link; optional row tap opens that insight.
 */
const SleepInsightsHomeCard = ({ homeMetricRows, onPressHeader, onPressMetricRow }) => {
  const isLoading = homeMetricRows === null;
  const hasRows = Array.isArray(homeMetricRows) && homeMetricRows.length > 0;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.headerRow} onPress={onPressHeader} activeOpacity={0.7}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Sleep Insights</Text>
          <Text style={styles.subtitle}>Discover what affects your sleep</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textLight} style={styles.headerChevron} />
      </TouchableOpacity>
      {hasRows && (
        <View style={styles.rowsSection}>
          {homeMetricRows.map((row, idx) => (
            <TouchableOpacity
              key={row.metricKey}
              style={[styles.metricRow, idx === 0 && styles.metricRowFirst]}
              onPress={() => onPressMetricRow?.(row)}
              activeOpacity={0.65}
            >
              <View style={styles.metricRowText}>
                <Text style={styles.metricLabel}>{row.metricLabel}</Text>
                <HomeInsightHeadline
                  headline={row.headline}
                  habitName={row.habitName}
                  impactDirection={row.impactDirection}
                />
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textLight}
                style={styles.metricRowChevron}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {isLoading && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>Loading insights...</Text>
        </View>
      )}
      {!isLoading && !hasRows && (
        <View style={styles.statusWrapper}>
          <Text style={styles.lineTextSecondary}>
            Open Sleep Insights to see progress per habit and any clear links.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
    minWidth: 0,
  },
  headerChevron: {
    marginLeft: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.medium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
  rowsSection: {
    marginTop: spacing.md,
    marginLeft: 0,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: 0,
    paddingLeft: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17, 41, 75, 0.18)',
  },
  metricRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  metricRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  metricRowChevron: {
    marginTop: 2,
    marginLeft: spacing.xs,
    marginRight: -2,
  },
  metricLabel: {
    fontSize: typography.sizes.small,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginBottom: 5,
  },
  headline: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 17,
    fontWeight: typography.weights.regular,
  },
  headlineHabit: {
    fontSize: typography.sizes.xs,
    lineHeight: 17,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  headlineDirWord: {
    fontSize: typography.sizes.xs,
    lineHeight: 17,
    fontWeight: typography.weights.bold,
  },
  statusWrapper: {
    marginTop: spacing.sm,
    marginLeft: 0,
    paddingVertical: spacing.xs,
  },
  lineTextSecondary: {
    fontSize: typography.sizes.small,
    color: colors.textSecondary,
  },
});

export default SleepInsightsHomeCard;
