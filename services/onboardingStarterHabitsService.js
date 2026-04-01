import { supabase } from './supabase';
import { requestHabitsRefresh } from './habitsRefreshTrigger';

const STARTER_DEFS = [
  { key: 'exercise', name: 'Exercise', type: 'binary' },
  { key: 'last_meal', name: 'Last meal time', type: 'time' },
  { key: 'eyemask', name: 'Eyemask', type: 'binary' },
];

/**
 * Creates selected starter habits for onboarding. Skips keys not in selection.
 * @param {string} userId
 * @param {{ exercise?: boolean, lastMeal?: boolean, eyemask?: boolean }} selected
 */
export async function createStarterHabits(userId, selected) {
  if (!userId) return { success: false };

  const { data: existing } = await supabase
    .from('habits')
    .select('priority')
    .eq('user_id', userId);

  let basePriority =
    existing && existing.length > 0 ? Math.max(...existing.map((h) => h.priority || 0)) + 1 : 0;

  const rows = [];
  for (const def of STARTER_DEFS) {
    let include = true;
    if (def.key === 'exercise') include = selected.exercise !== false;
    else if (def.key === 'last_meal') include = selected.lastMeal !== false;
    else if (def.key === 'eyemask') include = selected.eyemask !== false;
    if (!include) continue;

    rows.push({
      user_id: userId,
      name: def.name,
      type: def.type,
      unit: null,
      is_custom: true,
      is_active: true,
      priority: basePriority++,
    });
  }

  if (rows.length === 0) {
    requestHabitsRefresh();
    return { success: true, created: 0 };
  }

  const { error } = await supabase.from('habits').insert(rows);
  if (error) {
    return { success: false, error: error.message };
  }
  requestHabitsRefresh();
  return { success: true, created: rows.length };
}

export { STARTER_DEFS };
