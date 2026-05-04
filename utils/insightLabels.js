/**
 * Standardised labels for insights: Correlation (confidence) and Impact (effect size + direction).
 * Used across Home, Insights screen, and insight cards so wording is consistent.
 */

/** Correlation: how much we trust the pattern (from confidenceLevel) */
const CORRELATION_LABELS = {
  high: 'Strong correlation',
  medium: 'Medium correlation',
  low: 'Weak correlation',
  none: 'Not enough data',
};

/** One-word strength for correlation pills (matches onboarding: Weak / Medium / Strong). */
const CORRELATION_STRENGTH_SHORT = {
  high: 'Strong',
  medium: 'Medium',
  low: 'Weak',
  none: '—',
};

/** Impact size only (for building direction-aware labels); compact UI uses {@link getImpactStrengthBarCount} + signal bars. */
const IMPACT_SIZE_LABELS = {
  large: 'Large',
  moderate: 'Moderate',
  small: 'Small',
  minimal: 'Minimal',
};

/** Compact impact symbols (max 3 chars). Positive: +, ++, +++. Negative: -, --, ---. */
const IMPACT_SYMBOLS_POSITIVE = {
  minimal: '+',
  small: '++',
  moderate: '+++',
  large: '+++',
};

const IMPACT_SYMBOLS_NEGATIVE = {
  minimal: '-',
  small: '--',
  moderate: '---',
  large: '---',
};

/**
 * Get user-facing correlation label from confidence level (high/medium/low/none).
 * @param {string} confidenceLevel
 * @returns {string}
 */
export function getCorrelationLabel(confidenceLevel) {
  if (!confidenceLevel) return CORRELATION_LABELS.none;
  return CORRELATION_LABELS[confidenceLevel] ?? CORRELATION_LABELS.none;
}

/** Weak / Medium / Strong (or — when insufficient data), for correlation pills and compact tables. */
export function getCorrelationStrengthLabelShort(confidenceLevel) {
  if (!confidenceLevel) return CORRELATION_STRENGTH_SHORT.none;
  return CORRELATION_STRENGTH_SHORT[confidenceLevel] ?? CORRELATION_STRENGTH_SHORT.none;
}

/**
 * Impact badge text (legacy +/- symbols). Prefer {@link getImpactStrengthBarCount} + signal bars in UI.
 * @param {string} impactLevel - large | moderate | small | minimal
 * @param {boolean} isPositive - true for positive impact on sleep
 * @returns {string}
 */
export function getImpactLabel(impactLevel, isPositive = true) {
  return getImpactLabelShort(impactLevel, isPositive);
}

/**
 * Compact correlation label (legacy name). Same as {@link getCorrelationStrengthLabelShort}.
 * @param {string} confidenceLevel - high | medium | low | none
 * @returns {string}
 */
export function getCorrelationLabelShort(confidenceLevel) {
  return getCorrelationStrengthLabelShort(confidenceLevel);
}

/**
 * Short impact label for compact UI: + / ++ / +++ or - / -- / --- (max 3 characters).
 * @param {string} impactLevel - large | moderate | small | minimal
 * @param {boolean} isPositive - true for positive impact on sleep
 * @returns {string}
 */
export function getImpactLabelShort(impactLevel, isPositive = true) {
  if (!impactLevel) impactLevel = 'minimal';
  const table = isPositive ? IMPACT_SYMBOLS_POSITIVE : IMPACT_SYMBOLS_NEGATIVE;
  const key = table[impactLevel] ? impactLevel : 'minimal';
  return table[key];
}

/** Filled bars (1–3) for impact badges: aligns with former + / ++ / +++ granularity. */
export function getImpactStrengthBarCount(impactLevel) {
  if (!impactLevel) impactLevel = 'minimal';
  switch (impactLevel) {
    case 'large':
    case 'moderate':
      return 3;
    case 'small':
      return 2;
    default:
      return 1;
  }
}

/**
 * Bar colors on impact tag backgrounds.
 * @returns {{ filled: string, empty: string }}
 */
export function getImpactSignalBarColors(impactLevel, isPositive) {
  const { color } = getImpactTagStyle(impactLevel, isPositive);
  const lightOnDark = color === '#FFFFFF';
  if (lightOnDark) {
    return { filled: '#FFFFFF', empty: 'rgba(255,255,255,0.38)' };
  }
  if (isPositive) {
    return { filled: color, empty: 'rgba(6, 78, 59, 0.24)' };
  }
  return { filled: color, empty: 'rgba(127, 29, 29, 0.24)' };
}

/** VoiceOver / TalkBack description for correlation strength badge */
export function getInsightCorrelationAccessibilityLabel(confidenceLevel) {
  return `${getCorrelationLabel(confidenceLevel)}. Correlation strength.`;
}

/** VoiceOver / TalkBack description for sleep impact badge */
export function getInsightImpactAccessibilityLabel(impactLevel, isPositive) {
  const strengthWord =
    impactLevel === 'large' || impactLevel === 'moderate'
      ? 'Strong'
      : impactLevel === 'small'
        ? 'Medium'
        : 'Weak';
  const direction = isPositive ? 'Helps your sleep' : 'Hurts your sleep';
  return `${direction}. Effect strength: ${strengthWord}.`;
}

/**
 * Tag style for correlation confidence: blue tiers (mirrors impact’s green/red tier brightness).
 * @param {string} confidenceLevel - high | medium | low | none
 * @returns {{ backgroundColor: string, color: string }}
 */
export function getCorrelationTagStyle(confidenceLevel) {
  const styles = {
    high: { backgroundColor: '#1E40AF', color: '#FFFFFF' },
    medium: { backgroundColor: '#3B82F6', color: '#FFFFFF' },
    low: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
    none: { backgroundColor: '#E5E7EB', color: '#374151' },
  };
  const key = confidenceLevel && styles[confidenceLevel] ? confidenceLevel : 'none';
  return styles[key];
}

/**
 * Tag style for impact: red (negative) or green (positive), brighter for larger impact.
 * @param {string} impactLevel - large | moderate | small | minimal
 * @param {boolean} isPositive
 * @returns {{ backgroundColor: string, color: string }}
 */
export function getImpactTagStyle(impactLevel, isPositive) {
  const positive = {
    large:   { backgroundColor: '#059669', color: '#FFFFFF' },   // strong green
    moderate: { backgroundColor: '#10B981', color: '#FFFFFF' }, // green
    small:   { backgroundColor: '#34D399', color: '#064E3B' },  // lighter green, dark text
    minimal: { backgroundColor: '#A7F3D0', color: '#064E3B' },   // very light green
  };
  const negative = {
    large:   { backgroundColor: '#DC2626', color: '#FFFFFF' },   // strong red
    moderate: { backgroundColor: '#EF4444', color: '#FFFFFF' }, // red
    small:   { backgroundColor: '#F87171', color: '#7F1D1D' },  // lighter red, dark text
    minimal: { backgroundColor: '#FECACA', color: '#7F1D1D' },   // very light red
  };
  const key = impactLevel && (positive[impactLevel] || negative[impactLevel]) ? impactLevel : 'minimal';
  return isPositive ? positive[key] : negative[key];
}

/**
 * Get display label for home summary (e.g. "strong correlation", "moderate correlation").
 * @param {string} confidenceLevel
 * @returns {string}
 */
export function getCorrelationLabelForHome(confidenceLevel) {
  const label = getCorrelationLabel(confidenceLevel);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

// Backwards compatibility: evidence = correlation for any existing callers
export function getEvidenceLabel(confidenceLevel) {
  return getCorrelationLabel(confidenceLevel);
}

export function getEvidenceLabelForHome(confidenceLevel) {
  return getCorrelationLabelForHome(confidenceLevel);
}

export { CORRELATION_LABELS, IMPACT_SIZE_LABELS };
