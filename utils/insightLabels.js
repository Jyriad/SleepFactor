/**
 * Standardised labels for insights: Evidence (confidence) and Impact (effect size).
 * Used across Home, Insights screen, and insight cards so wording is consistent.
 */

/** Evidence: how much we trust the result (from confidenceLevel) */
const EVIDENCE_LABELS = {
  high: 'Strong evidence',
  medium: 'Moderate evidence',
  low: 'Limited evidence',
  none: 'Not enough data',
};

/** Impact: how much the habit affects sleep (from impactLevel) */
const IMPACT_LABELS = {
  large: 'Large impact',
  moderate: 'Moderate impact',
  small: 'Small impact',
  minimal: 'Minimal impact',
};

/**
 * Get user-facing evidence label from confidence level (high/medium/low/none).
 * @param {string} confidenceLevel
 * @returns {string}
 */
export function getEvidenceLabel(confidenceLevel) {
  if (!confidenceLevel) return EVIDENCE_LABELS.none;
  return EVIDENCE_LABELS[confidenceLevel] ?? EVIDENCE_LABELS.none;
}

/**
 * Get user-facing impact label from impact level (large/moderate/small/minimal).
 * @param {string} impactLevel
 * @returns {string}
 */
export function getImpactLabel(impactLevel) {
  if (!impactLevel) return IMPACT_LABELS.minimal;
  return IMPACT_LABELS[impactLevel] ?? IMPACT_LABELS.minimal;
}

/**
 * Get display label for home summary (e.g. "strong evidence", "moderate evidence").
 * Uses same wording as evidence but lowercase for stat lines.
 * @param {string} confidenceLevel
 * @returns {string}
 */
export function getEvidenceLabelForHome(confidenceLevel) {
  const label = getEvidenceLabel(confidenceLevel);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export { EVIDENCE_LABELS, IMPACT_LABELS };
