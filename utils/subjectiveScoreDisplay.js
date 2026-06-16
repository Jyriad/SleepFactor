const SHORT_MEASURE_LABELS = {
  'Refreshed feeling': 'Refreshed',
  'Dream strength': 'Dreams',
  'Easily fell asleep': 'Fell asleep',
};

function shortMeasureLabel(label) {
  if (!label || typeof label !== 'string') return 'Score';
  return SHORT_MEASURE_LABELS[label] || label;
}

/**
 * Compact summary for the home "How did you sleep?" card - lists every logged score.
 */
export function formatHomeSubjectiveSummary(
  lastNight,
  { trackTiredness = true, trackDreamVividness = true } = {}
) {
  if (!lastNight || typeof lastNight !== 'object') return 'No score yet';

  const parts = [];
  if (trackTiredness && lastNight.tiredness_score != null) {
    parts.push(`Refreshed ${lastNight.tiredness_score}/10`);
  }
  if (trackDreamVividness && lastNight.dream_vividness_score != null) {
    parts.push(`Dreams ${lastNight.dream_vividness_score}/10`);
  }
  if (Array.isArray(lastNight.extra)) {
    for (const row of lastNight.extra) {
      if (row?.score != null) {
        parts.push(`${shortMeasureLabel(row.label)} ${row.score}/10`);
      }
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'No score yet';
}
