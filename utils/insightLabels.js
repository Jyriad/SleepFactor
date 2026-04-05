/**
 * Standardised labels for insights: Correlation (confidence) and Impact (effect size + direction).
 * Used across Home, Insights screen, and insight cards so wording is consistent.
 */

/** Correlation: how much we trust the result (from confidenceLevel) */
const CORRELATION_LABELS = {
  high: 'Strong correlation',
  medium: 'Moderate correlation',
  low: 'Limited correlation',
  none: 'Not enough data',
};

/** Impact size only (for building direction-aware labels) — legacy wording; UI uses symbols via getImpactLabelShort */
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

/**
 * Impact badge text: same symbols as {@link getImpactLabelShort} (+ / ++ / +++ or - / -- / ---).
 * @param {string} impactLevel - large | moderate | small | minimal
 * @param {boolean} isPositive - true for positive impact on sleep
 * @returns {string}
 */
export function getImpactLabel(impactLevel, isPositive = true) {
  return getImpactLabelShort(impactLevel, isPositive);
}

/** Link / confidence strength symbols (same pattern as impact: + / ++ / +++). */
const CORRELATION_SYMBOLS = {
  high: '+++',
  medium: '++',
  low: '+',
  none: '—',
};

/**
 * Short link-strength label for compact UI (pills, table cells): + / ++ / +++ or — when insufficient data.
 * @param {string} confidenceLevel - high | medium | low | none
 * @returns {string}
 */
export function getCorrelationLabelShort(confidenceLevel) {
  if (!confidenceLevel) return CORRELATION_SYMBOLS.none;
  const key = CORRELATION_SYMBOLS[confidenceLevel] ? confidenceLevel : 'none';
  return CORRELATION_SYMBOLS[key];
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

/**
 * Tag style for link / confidence strength: blue tiers (mirrors impact’s green/red tier brightness).
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
