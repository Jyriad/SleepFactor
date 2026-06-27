import { getProfileLabelForEvent } from '../constants/consumptionServingProfiles';

/**
 * Build unique frequent drink combos from historical events (last 30 days).
 * @returns {Array<{ key, optionId, option, volumeMl, abvPercent, profileId, label, count }>}
 */
export function buildFrequentConsumptionCombos(events, options, habitName, measurementRegion, limit = 3) {
  if (!events?.length || !options?.length) return [];

  const optionById = new Map(options.map((o) => [o.id, o]));
  const counts = new Map();

  events.forEach((event) => {
    if (!event?.drink_type || event.drink_type === 'none') return;
    const option = optionById.get(event.drink_type);
    if (!option) return;

    const volumeMl =
      event.logged_volume_ml != null && Number(event.logged_volume_ml) > 0
        ? Number(event.logged_volume_ml)
        : event.volume != null && Number(event.volume) > 0
          ? Number(event.volume)
          : null;
    const abv =
      event.logged_abv_percent != null && Number(event.logged_abv_percent) > 0
        ? Number(event.logged_abv_percent)
        : null;
    const profileId = event.logged_serving_profile_id || null;

    const key = `${event.drink_type}|${volumeMl ?? ''}|${abv ?? ''}|${profileId ?? ''}`;
    const profileLabel = getProfileLabelForEvent(event, option, habitName, measurementRegion);
    const sizeLabel =
      profileLabel ||
      (volumeMl != null ? `${Math.round(volumeMl)} ml` : null);

    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, {
        key,
        optionId: event.drink_type,
        option,
        volumeMl,
        abvPercent: abv,
        profileId,
        sizeLabel,
        count: 1,
      });
    }
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => ({
      ...row,
      label: row.sizeLabel ? `${row.option.name} - ${row.sizeLabel}` : row.option.name,
    }));
}
