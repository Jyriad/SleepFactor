import { supabase } from './supabase';

function randomSlug() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `custom_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
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
 * Ensure built-in rows exist (e.g. after migration not applied). Idempotent.
 */
export async function ensureBuiltinMeasures(userId) {
  if (!userId) return;
  // RLS ensures rows are only written for auth.uid(); do not gate on getUser() — session timing can skip upserts.

  const { data: urow } = await supabase
    .from('users')
    .select('track_tiredness, track_dream_vividness')
    .eq('id', userId)
    .single();

  const builtins = [
    {
      slug: 'tiredness',
      label: 'Refreshed feeling',
      hint: 'How refreshed did you feel when you first woke up?',
      left_label: 'Not refreshed',
      right_label: 'Very refreshed',
      sort_order: 0,
      enabled: urow?.track_tiredness === true,
    },
    {
      slug: 'dream_vividness',
      label: 'Dream strength',
      hint: 'How strong or vivid did your dreams feel?',
      left_label: 'No memory',
      right_label: 'Very strong',
      sort_order: 1,
      enabled: urow?.track_dream_vividness === true,
    },
  ];

  for (const b of builtins) {
    await supabase.from('user_subjective_measures').upsert(
      {
        user_id: userId,
        slug: b.slug,
        label: b.label,
        hint: b.hint,
        left_label: b.left_label,
        right_label: b.right_label,
        sort_order: b.sort_order,
        enabled: b.enabled,
        is_builtin: true,
      },
      { onConflict: 'user_id,slug' }
    );
  }
}

/**
 * Set enabled flag for a measure; for built-ins also mirrors users.track_*.
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

  if (row.is_builtin) {
    const updates = {};
    if (row.slug === 'tiredness') updates.track_tiredness = enabled;
    if (row.slug === 'dream_vividness') updates.track_dream_vividness = enabled;
    if (Object.keys(updates).length > 0) {
      await supabase.from('users').update(updates).eq('id', userId);
    }
  }

  if (enabled) {
    const { data: u } = await supabase.from('users').select('morning_checkin_time').eq('id', userId).maybeSingle();
    if (u && (u.morning_checkin_time == null || String(u.morning_checkin_time).trim() === '')) {
      await supabase.from('users').update({ morning_checkin_time: '08:00:00' }).eq('id', userId);
    }
  }

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
  return { success: true, id: data?.id };
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
  return { success: true };
}

/**
 * True if any configured measure is enabled (for morning check-in scheduling).
 */
/** Map measure_id -> score for a sleep date (custom measures only; built-ins use sleep_data). */
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
  ensureBuiltinMeasures,
  setMeasureEnabled,
  addCustomMeasure,
  deleteCustomMeasure,
  getCustomScoresForDate,
  hasAnySubjectiveMeasureEnabled,
};
