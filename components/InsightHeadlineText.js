import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants';

/** @param {string} s */
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build plain / habit-bold / directional color segments for insight headline lines.
 */
export function buildHeadlineParts(headline, habitName, impactDirection) {
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

/**
 * Styled one-line insight headline (home card, insights list rows).
 */
const InsightHeadlineText = ({
  headline,
  habitName,
  impactDirection,
  numberOfLines = 3,
  style,
  habitStyle,
  dirStyle,
}) => {
  const parts = useMemo(
    () => buildHeadlineParts(headline, habitName, impactDirection),
    [headline, habitName, impactDirection]
  );

  return (
    <Text style={[styles.headline, style]} numberOfLines={numberOfLines}>
      {parts.map((p, idx) => {
        if (p.type === 'habit') {
          return (
            <Text key={idx} style={[styles.headlineHabit, habitStyle]}>
              {p.text}
            </Text>
          );
        }
        if (p.type === 'dir') {
          return (
            <Text key={idx} style={[styles.headlineDirWord, dirStyle, { color: p.color }]}>
              {p.text}
            </Text>
          );
        }
        return <Text key={idx}>{p.text}</Text>;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
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
});

export default InsightHeadlineText;
