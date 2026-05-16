import { supabase } from './supabase';
import insightsService from './insightsService';

function randomSlug() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `custom_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Built-in slugs — single source of truth is `user_subjective_measures`; users.track_* are legacy mirrors. */
const BUILTIN_SLUGS = ['tiredness', 'dream_vividness', 'ease_sleep'];

const BUILTIN_ROW_TEMPLATES = {
  tiredness: {
    label: 'Refreshed feeling',
    hint: 'How refreshed did you feel when you first woke up?',
    left_label: 'Not refreshed',
    right_label: 'Very refreshed',
    sort_order: 0,
  },
  dream_vividness: {
    label: 'Dream strength',
    hint: 'How strong or vivid did your dreams feel?',
    left_label: 'No memory',
    right_label: 'Very strong',
    sort_order: 1,
  },
  ease_sleep: {
    label: 'Easily fell asleep',
    hint: 'How easily did you fall asleep?',
    left_label: 'Very difficult',
    right_label: 'Very easily',
    sort_order: 2,
  },
};

/**
 * Dual-write legacy `users` columns from measure rows so older app builds and RPC payloads stay consistent.
 * Row present & enabled → track_* true, subjective_remove_* false.
 * Row present & disabled → track_* false, subjective_remove_* false.
 * No row → track_* false, subjective_remove_* true (do not auto-seed).
 */
export async function syncLegacyUserSubjectiveColumnsFromMeasures(userId) {
  if (!userId) return { success: false };
  const { data: rows, error } = await supabase
    .from('user_subjective_measures')
    .select('slug, enabled')
    .eq('user_id', userId)
    .in('slug', BUILTIN_SLUGS);
  if (error) return { success: false, error: error.message };

  const bySlug = {};
  for (const r of rows || []) {
    bySlug[r.slug] = r;
  }

  const updates = {};
  const apply = (slug, trackKey, removeKey) => {
    const row = bySlug[slug];
    if (row) {
      updates[trackKey] = row.enabled === true;
      updates[removeKey] = false;
    } else {
      updates[trackKey] = false;
      updates[removeKey] = true;
    }
  };
  apply('tiredness', 'track_tiredness', 'subjective_remove_tiredness_measure');
  apply('dream_vividness', 'track_dream_vividness', 'subjective_remove_dream_measure');
  apply('ease_sleep', 'track_ease_sleep', 'subjective_remove_ease_sleep_measure');

  const { error: upErr } = await supabase.from('users').update(updates).eq('id', userId);
  if (upErr) return { success: false, error: upErr.message };
  return { success: true };
}

async function applyBuiltinSelection(userId, slug, selected) {
  const tmpl = BUILTIN_ROW_TEMPLATES[slug];
  if (!tmpl || !userId) return { success: false };
  if (selected) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('user_subjective_measures').upsert(
      {
        user_id: userId,
        slug,
        ...tmpl,
        enabled: true,
        is_builtin: true,
        updated_at: nowIso,
      },
      { onConflict: 'user_id,slug' }
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  }
  const { error: delErr } = await supabase
    .from('user_subjective_measures')
    .delete()
    .eq('user_id', userId)
    .eq('slug', slug);
  if (delErr) return { success: false, error: delErr.message };
  return { success: true };
}

async function maybeDefaultMorningCheckinTime(userId) {
  const { data: u } = await supabase.from('users').select('morning_checkin_time').eq('id', userId).maybeSingle();
  if (u && (u.morning_checkin_time == null || String(u.morning_checkin_time).trim() === '')) {
    await supabase.from('users').update({ morning_checkin_time: '08:00:00' }).eq('id', userId);
  }
}

/**
 * Onboarding: selected built-ins get rows; unselected rows are removed.
 */
export async function persistOnboardingSubjectiveBuiltinChoices(userId, { tiredness, dream, easeSleep }) {
  if (!userId) return { success: false };
  const r1 = await applyBuiltinSelection(userId, 'tiredness', tiredness === true);
  if (!r1.success) return r1;
  const r2 = await applyBuiltinSelection(userId, 'dream_vividness', dream === true);
  if (!r2.success) return r2;
  const r3 = await applyBuiltinSelection(userId, 'ease_sleep', easeSleep === true);
  if (!r3.success) return r3;
  const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  if (!syncRes.success) return syncRes;
  return { success: true };
}

/** Ensure the tiredness built-in exists and is enabled (e.g. notification onboarding default). */
export async function ensureBuiltinMeasurePresentAndEnabled(userId, slug = 'tiredness') {
  if (!userId || !BUILTIN_ROW_TEMPLATES[slug]) return { success: false };
  const sel = await applyBuiltinSelection(userId, slug, true);
  if (!sel.success) return sel;
  await maybeDefaultMorningCheckinTime(userId);
  const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  if (!syncRes.success) return syncRes;
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

/**
 * Legacy UI rows (no DB id): turn toggle into real rows + legacy column sync.
 */
export async function materializeLegacyBuiltinAndSetEnabled(userId, slug, enabled) {
  if (!userId || !BUILTIN_ROW_TEMPLATES[slug]) return { success: false, error: 'Invalid measure' };

  if (enabled) {
    const sel = await applyBuiltinSelection(userId, slug, true);
    if (!sel.success) return { success: false, error: sel.error };
    await maybeDefaultMorningCheckinTime(userId);
    const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
    if (!syncRes.success) return { success: false, error: syncRes.error };
    insightsService.notifyInsightsUnderlyingDataChanged();
    return { success: true };
  }

  const { data: row } = await supabase
    .from('user_subjective_measures')
    .select('id')
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();

  if (row?.id) {
    const res = await setMeasureEnabled(userId, row.id, false);
    return res;
  }

  const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  if (!syncRes.success) return { success: false, error: syncRes.error };
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

/**
 * List all subjective measures for a user (built-in + custom), ordered for display.
 */
export async function listSubjectiveMeasures(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('user_subjective_measures')
    .select('id, slug, label, hint, left_label, right_label, sort_order, enabled, is_builtin, created_at')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Legacy repair: insert missing built-in rows when old clients only updated users.track_*.
 * Does not remove rows; source of truth remains measures once rows exist.
 */
export async function ensureBuiltinMeasures(userId) {
  if (!userId) return;

  const { data: urow } = await supabase
    .from('users')
    .select(
      'track_tiredness, track_dream_vividness, track_ease_sleep, subjective_remove_tiredness_measure, subjective_remove_dream_measure, subjective_remove_ease_sleep_measure'
    )
    .eq('id', userId)
    .single();

  const desired = [
    {
      slug: 'tiredness',
      ...BUILTIN_ROW_TEMPLATES.tiredness,
      shouldExist: urow?.track_tiredness === true,
    },
    {
      slug: 'dream_vividness',
      ...BUILTIN_ROW_TEMPLATES.dream_vividness,
      shouldExist: urow?.track_dream_vividness === true,
    },
    {
      slug: 'ease_sleep',
      ...BUILTIN_ROW_TEMPLATES.ease_sleep,
      shouldExist: urow?.track_ease_sleep === true,
    },
  ];

  let existingSlugs = new Set();
  try {
    const { data: existingRows } = await supabase
      .from('user_subjective_measures')
      .select('slug')
      .eq('user_id', userId)
      .in('slug', BUILTIN_SLUGS);
    existingSlugs = new Set((existingRows || []).map((r) => r.slug).filter(Boolean));
  } catch (_e) {
    existingSlugs = new Set();
  }

  const rowsToInsert = [];
  for (const b of desired) {
    if (b.slug === 'tiredness' && urow?.subjective_remove_tiredness_measure) continue;
    if (b.slug === 'dream_vividness' && urow?.subjective_remove_dream_measure) continue;
    if (b.slug === 'ease_sleep' && urow?.subjective_remove_ease_sleep_measure) continue;
    if (!b.shouldExist) continue;
    if (existingSlugs.has(b.slug)) continue;

    rowsToInsert.push({
      user_id: userId,
      slug: b.slug,
      label: b.label,
      hint: b.hint,
      left_label: b.left_label,
      right_label: b.right_label,
      sort_order: b.sort_order,
      enabled: true,
      is_builtin: true,
    });
  }

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('user_subjective_measures').insert(rowsToInsert);
    if (insertErr) {
      console.warn('[SleepFactor] ensureBuiltinMeasures insert failed:', insertErr.message);
    }
  }

  if (rowsToInsert.length > 0) {
    await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  }
}

/** Virtual rows when the measures table returns nothing but users.track_* is still on. */
function buildLegacySubjectiveMeasuresFromUserRow(userRow) {
  if (!userRow) return [];
  const rows = [];
  if (!userRow.subjective_remove_tiredness_measure && userRow.track_tiredness === true) {
    rows.push({
      id: 'legacy-tiredness',
      slug: 'tiredness',
      label: 'Refreshed feeling',
      hint: null,
      left_label: 'Not refreshed',
      right_label: 'Very refreshed',
      sort_order: 0,
      enabled: userRow.track_tiredness === true,
      is_builtin: true,
      _legacy: true,
    });
  }
  if (!userRow.subjective_remove_dream_measure && userRow.track_dream_vividness === true) {
    rows.push({
      id: 'legacy-dream',
      slug: 'dream_vividness',
      label: 'Dream strength',
      hint: null,
      left_label: 'No memory',
      right_label: 'Very strong',
      sort_order: 1,
      enabled: userRow.track_dream_vividness === true,
      is_builtin: true,
      _legacy: true,
    });
  }
  if (!userRow.subjective_remove_ease_sleep_measure && userRow.track_ease_sleep === true) {
    rows.push({
      id: 'legacy-ease_sleep',
      slug: 'ease_sleep',
      label: 'Easily fell asleep',
      hint: null,
      left_label: 'Very difficult',
      right_label: 'Very easily',
      sort_order: 2,
      enabled: userRow.track_ease_sleep === true,
      is_builtin: true,
      _legacy: true,
    });
  }
  return rows;
}

/**
 * Same list the "Set up what you log" screen uses — includes legacy placeholder rows when
 * user_subjective_measures is empty but profile toggles say tracking is on.
 */
export async function listSubjectiveMeasuresWithLegacyFallback(userId) {
  if (!userId) return [];
  await ensureBuiltinMeasures(userId);
  const fetched = await listSubjectiveMeasures(userId);
  let list = Array.isArray(fetched) ? fetched : [];
  if (list.length > 0) {
    await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
    return list;
  }

  const { data: userRow, error } = await supabase
    .from('users')
    .select(
      'track_tiredness, track_dream_vividness, track_ease_sleep, subjective_remove_tiredness_measure, subjective_remove_dream_measure, subjective_remove_ease_sleep_measure'
    )
    .eq('id', userId)
    .single();

  if (error || !userRow) return list;
  return buildLegacySubjectiveMeasuresFromUserRow(userRow);
}

/**
 * Swap placeholder legacy rows for real DB rows when inserts have caught up — needed before
 * writing subjective_score_entries (measure_id must be a real row id).
 */
export async function resolveLegacyMeasuresToDbRows(userId, measures) {
  if (!userId || !Array.isArray(measures) || !measures.some((m) => m && m._legacy)) {
    return measures;
  }
  await ensureBuiltinMeasures(userId);
  const freshList = await listSubjectiveMeasures(userId);
  return measures.map((m) => {
    if (!m || !m._legacy) return m;
    const row = freshList.find((r) => r.slug === m.slug && r.is_builtin);
    if (!row) return m;
    return { ...row, enabled: Boolean(m.enabled) };
  });
}

/**
 * Set enabled flag for a measure; syncs legacy users.* mirrors from `user_subjective_measures`.
 */
export async function setMeasureEnabled(userId, measureId, enabled) {
  if (!userId || !measureId) return { success: false };

  const { data: row, error: fetchErr } = await supabase
    .from('user_subjective_measures')
    .select('id, slug, is_builtin')
    .eq('user_id', userId)
    .eq('id', measureId)
    .single();
  if (fetchErr || !row) return { success: false, error: fetchErr?.message };

  const { error } = await supabase
    .from('user_subjective_measures')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', measureId)
    .eq('user_id', userId);
  if (error) return { success: false, error: error.message };

  const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  if (!syncRes.success) return { success: false, error: syncRes.error };

  if (enabled) {
    await maybeDefaultMorningCheckinTime(userId);
  }

  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

/**
 * Add a custom measure (1–10 slider).
 */
export async function addCustomMeasure(userId, { label, hint, leftLabel, rightLabel }) {
  if (!userId) return { success: false, error: 'No user' };
  const trimmed = (label || '').trim();
  if (!trimmed) return { success: false, error: 'Enter a name' };

  const slug = randomSlug();
  const { data, error } = await supabase
    .from('user_subjective_measures')
    .insert({
      user_id: userId,
      slug,
      label: trimmed.slice(0, 120),
      hint: hint != null ? String(hint).slice(0, 300) : null,
      left_label: (leftLabel || 'Low').slice(0, 80),
      right_label: (rightLabel || 'High').slice(0, 80),
      sort_order: 100,
      enabled: true,
      is_builtin: false,
    })
    .select('id')
    .single();
  if (error) return { success: false, error: error.message };
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true, id: data?.id };
}

/**
 * Update an existing subjective measure (built-in or custom) display fields.
 */
export async function updateSubjectiveMeasure(userId, measureId, { label, hint, leftLabel, rightLabel }) {
  if (!userId || !measureId) return { success: false, error: 'Invalid measure' };
  const trimmed = (label || '').trim();
  if (!trimmed) return { success: false, error: 'Enter a name' };

  const { error } = await supabase
    .from('user_subjective_measures')
    .update({
      label: trimmed.slice(0, 120),
      hint: hint != null && String(hint).trim() !== '' ? String(hint).slice(0, 300) : null,
      left_label: (leftLabel || 'Low').slice(0, 80),
      right_label: (rightLabel || 'High').slice(0, 80),
      updated_at: new Date().toISOString(),
    })
    .eq('id', measureId)
    .eq('user_id', userId);

  if (error) return { success: false, error: error.message };
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

export async function deleteCustomMeasure(userId, measureId) {
  if (!userId || !measureId) return { success: false };
  const { data: row, error: fetchErr } = await supabase
    .from('user_subjective_measures')
    .select('id, is_builtin')
    .eq('user_id', userId)
    .eq('id', measureId)
    .single();
  if (fetchErr || !row || row.is_builtin) return { success: false };

  const { error } = await supabase.from('user_subjective_measures').delete().eq('id', measureId).eq('user_id', userId);
  if (error) return { success: false, error: error.message };
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

/**
 * Remove a measure from the user's list: custom rows, or built-in Refreshed feeling / Dream strength.
 * Built-in removal deletes the row and syncs legacy columns. Legacy list ids (e.g. legacy-tiredness) are handled.
 */
export async function deleteSubjectiveMeasure(userId, measureId) {
  if (!userId || measureId == null) return { success: false, error: 'Invalid' };
  const mid = String(measureId);
  if (mid === 'legacy-tiredness' || mid === 'legacy-dream' || mid === 'legacy-ease_sleep') {
    const slug =
      mid === 'legacy-tiredness' ? 'tiredness' : mid === 'legacy-dream' ? 'dream_vividness' : 'ease_sleep';
    const sel = await applyBuiltinSelection(userId, slug, false);
    if (!sel.success) return { success: false, error: sel.error };
    const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
    if (!syncRes.success) return { success: false, error: syncRes.error };
    insightsService.notifyInsightsUnderlyingDataChanged();
    return { success: true };
  }

  const { data: row, error: fetchErr } = await supabase
    .from('user_subjective_measures')
    .select('id, slug, is_builtin')
    .eq('user_id', userId)
    .eq('id', measureId)
    .maybeSingle();
  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!row) return { success: false, error: 'Not found' };

  if (!row.is_builtin) {
    return deleteCustomMeasure(userId, measureId);
  }
  if (row.slug !== 'tiredness' && row.slug !== 'dream_vividness' && row.slug !== 'ease_sleep') {
    return { success: false, error: 'Cannot remove this measure' };
  }

  const { error: delErr } = await supabase
    .from('user_subjective_measures')
    .delete()
    .eq('id', row.id)
    .eq('user_id', userId);
  if (delErr) return { success: false, error: delErr.message };

  const syncRes = await syncLegacyUserSubjectiveColumnsFromMeasures(userId);
  if (!syncRes.success) return { success: false, error: syncRes.error };
  insightsService.notifyInsightsUnderlyingDataChanged();
  return { success: true };
}

/**
 * Map measure_id -> score for a sleep date (custom measures only; built-ins use sleep_data).
 */
export async function getCustomScoresForDate(userId, dateStr) {
  if (!userId || !dateStr) return {};
  const { data, error } = await supabase
    .from('subjective_score_entries')
    .select('measure_id, score')
    .eq('user_id', userId)
    .eq('sleep_date', dateStr);
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    map[row.measure_id] = row.score;
  }
  return map;
}

/**
 * True if any configured measure is enabled (for morning check-in scheduling).
 */
export async function hasAnySubjectiveMeasureEnabled(userId) {
  if (!userId) return false;
  const { count, error } = await supabase
    .from('user_subjective_measures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enabled', true);
  if (error) return false;
  return (count || 0) > 0;
}

export default {
  listSubjectiveMeasures,
  listSubjectiveMeasuresWithLegacyFallback,
  resolveLegacyMeasuresToDbRows,
  ensureBuiltinMeasures,
  syncLegacyUserSubjectiveColumnsFromMeasures,
  persistOnboardingSubjectiveBuiltinChoices,
  ensureBuiltinMeasurePresentAndEnabled,
  materializeLegacyBuiltinAndSetEnabled,
  setMeasureEnabled,
  addCustomMeasure,
  updateSubjectiveMeasure,
  deleteCustomMeasure,
  deleteSubjectiveMeasure,
  getCustomScoresForDate,
  hasAnySubjectiveMeasureEnabled,
};
