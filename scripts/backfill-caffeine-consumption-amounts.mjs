#!/usr/bin/env node
/**
 * Backfill habit_consumption_events.amount and drug_levels.level_value after
 * consumption_options.drug_amount (or default_volume) changes for caffeine.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Load from .env.local:
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/backfill-caffeine-consumption-amounts.mjs --dry-run
 *   node scripts/backfill-caffeine-consumption-amounts.mjs
 *   node scripts/backfill-caffeine-consumption-amounts.mjs --measurement-region US
 *   node scripts/backfill-caffeine-consumption-amounts.mjs --old-drug-amounts ./old-amounts.json
 *
 * old-amounts.json (optional): { "option-uuid": 64 } for ratio scaling when volume is missing.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  resolveIntakeBasis,
  INTAKE_BASIS,
  getReferenceVolumeMlForOption,
  getReferenceServingCount,
} from '../utils/consumptionIntake.js';
import {
  getBedtimeDrugLevel,
  habitUsesCaffeineMgFloor,
  applyCaffeineMgFloor,
  CAFFEINE_MG_FLOOR,
} from '../utils/drugHalfLife.js';
import { addCalendarDay } from '../utils/dateHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LEGACY_DRINK_TYPE_MAP = {
  espresso: 'Espresso',
  instant_coffee: 'Instant Coffee',
  energy_drink: 'Energy Drink',
  soft_drink: 'Soft Drink',
  beer: 'Beer',
  wine: 'Wine',
  liquor: 'Liquor',
  cocktail: 'Cocktail',
};

function loadEnvLocal() {
  const p = join(__dirname, '..', '.env.local');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    dryRun: false,
    measurementRegion: 'metric',
    oldDrugAmountsPath: null,
    limitEvents: null,
    habitId: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--measurement-region' && args[i + 1]) {
      out.measurementRegion = args[++i];
    } else if (a === '--old-drug-amounts' && args[i + 1]) {
      out.oldDrugAmountsPath = args[++i];
    } else if (a === '--limit' && args[i + 1]) {
      out.limitEvents = parseInt(args[++i], 10);
    } else if (a === '--habit-id' && args[i + 1]) {
      out.habitId = args[++i];
    }
  }
  return out;
}

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''));
}

function localDateInTz(isoString, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoString));
  }
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function computeAmountFromVolume(volumeMl, refVolumeMl, drugAmount) {
  if (volumeMl == null || volumeMl <= 0 || refVolumeMl == null || refVolumeMl <= 0) return null;
  return round1((volumeMl / refVolumeMl) * drugAmount);
}

/**
 * @param {object} event
 * @param {object} option - consumption_options row
 * @param {string} habitName
 * @param {string} measurementRegion
 * @param {Record<string, number>|null} oldDrugAmounts - option id -> old drug_amount for ratio fallback
 */
function computeNewAmount(event, option, habitName, measurementRegion, oldDrugAmounts) {
  const drugAmount = Number(option.drug_amount);
  if (Number.isNaN(drugAmount) || drugAmount <= 0) return null;
  const basis = resolveIntakeBasis(option);

  if (basis === INTAKE_BASIS.SERVING_COUNT) {
    const totalCount =
      event.logged_serving_count != null && Number(event.logged_serving_count) > 0
        ? Number(event.logged_serving_count)
        : event.volume != null && Number(event.volume) > 0
          ? Number(event.volume)
          : null;
    const ref = getReferenceServingCount(option);
    if (totalCount != null && totalCount > 0 && ref != null && ref > 0) {
      return computeAmountFromVolume(totalCount, ref, drugAmount);
    }
    return null;
  }

  const vol =
    event.logged_volume_ml != null && Number(event.logged_volume_ml) > 0
      ? Number(event.logged_volume_ml)
      : event.volume != null && Number(event.volume) > 0
        ? Number(event.volume)
        : null;
  const refVol = getReferenceVolumeMlForOption(option, habitName, measurementRegion);

  if (vol != null && vol > 0 && refVol != null && refVol > 0) {
    return computeAmountFromVolume(vol, refVol, drugAmount);
  }

  if (oldDrugAmounts && oldDrugAmounts[option.id] != null) {
    const oldDrug = Number(oldDrugAmounts[option.id]);
    const oldAmt = Number(event.amount);
    if (oldDrug > 0 && !Number.isNaN(oldAmt)) {
      return round1((oldAmt / oldDrug) * drugAmount);
    }
  }

  return null;
}

async function fetchCaffeineHabits(supabase, habitIdFilter) {
  let q = supabase
    .from('habits')
    .select('id, name, type, unit, half_life_hours')
    .eq('type', 'quick_consumption')
    .ilike('name', '%caffeine%');
  if (habitIdFilter) q = q.eq('id', habitIdFilter);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function fetchOptionsByHabit(supabase, habitIds) {
  if (!habitIds.length) return { byId: new Map(), byHabitAndName: new Map() };

  const { data: globalRows, error: gErr } = await supabase
    .from('consumption_options')
    .select('*')
    .eq('preset_scope', 'caffeine')
    .is('user_id', null)
    .eq('is_active', true);
  if (gErr) throw gErr;

  const { data: habitRows, error: hErr } = await supabase
    .from('consumption_options')
    .select('*')
    .in('habit_id', habitIds)
    .eq('is_active', true);
  if (hErr) throw hErr;

  const byId = new Map();
  const byHabitAndName = new Map();

  for (const o of globalRows || []) {
    byId.set(o.id, o);
    for (const hid of habitIds) {
      const key = `${hid}::${(o.name || '').trim()}`;
      if (!byHabitAndName.has(key)) byHabitAndName.set(key, o);
    }
  }

  for (const o of habitRows || []) {
    byId.set(o.id, o);
    if (o.habit_id) {
      const key = `${o.habit_id}::${(o.name || '').trim()}`;
      byHabitAndName.set(key, o);
    }
  }

  return { byId, byHabitAndName };
}

function resolveOptionForEvent(event, habitsById, optionsById, byHabitAndName) {
  const habit = habitsById.get(event.habit_id);
  if (!habit) return null;
  const dt = event.drink_type;
  if (!dt || dt === 'none') return null;

  if (isUuid(dt)) {
    return optionsById.get(dt) || null;
  }
  const legacyName = LEGACY_DRINK_TYPE_MAP[String(dt).toLowerCase()];
  if (legacyName) {
    return byHabitAndName.get(`${event.habit_id}::${legacyName}`) || null;
  }
  const normalized = String(dt).toLowerCase().replace(/\s+/g, '_');
  for (const [k, o] of byHabitAndName) {
    if (k.startsWith(`${event.habit_id}::`) && o.name.toLowerCase().replace(/\s+/g, '_') === normalized) {
      return o;
    }
  }
  return null;
}

async function fetchAllEventsForHabits(supabase, habitIds, limit) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    let q = supabase
      .from('habit_consumption_events')
      .select('*')
      .in('habit_id', habitIds)
      .order('consumed_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    if (limit != null && all.length >= limit) break;
  }
  return limit != null ? all.slice(0, limit) : all;
}

async function resolveBedtime(supabase, userId, dateStr, timeZone) {
  const nextDayStr = addCalendarDay(dateStr);
  const { data: sleepRow } = await supabase
    .from('sleep_data')
    .select('sleep_start_time')
    .eq('user_id', userId)
    .eq('date', nextDayStr)
    .maybeSingle();

  if (sleepRow?.sleep_start_time) {
    return new Date(sleepRow.sleep_start_time);
  }

  const { data: userData } = await supabase.from('users').select('notification_time').eq('id', userId).single();
  const notificationTime = userData?.notification_time || '22:00:00';
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min, sec] = notificationTime.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, sec || 0, 0);
}

async function recomputeDrugLevelForDate(supabase, userId, habit, dateStr, userTz) {
  const halfLife = habit.half_life_hours != null ? Number(habit.half_life_hours) : 5;
  const minMg = habitUsesCaffeineMgFloor(habit.name) ? CAFFEINE_MG_FLOOR : null;

  const targetBedtime = await resolveBedtime(supabase, userId, dateStr, userTz);
  if (!targetBedtime || Number.isNaN(targetBedtime.getTime())) {
    return { level: 0, bedtimeAt: null };
  }

  const historyDays = Math.max(3, Math.ceil((halfLife * 3) / 24));
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const fetchStart = new Date(dayStart);
  fetchStart.setDate(fetchStart.getDate() - historyDays);

  const { data: events, error } = await supabase
    .from('habit_consumption_events')
    .select('*')
    .eq('user_id', userId)
    .eq('habit_id', habit.id)
    .gte('consumed_at', fetchStart.toISOString())
    .lte('consumed_at', targetBedtime.toISOString())
    .order('consumed_at', { ascending: true });

  if (error) throw error;

  let level =
    events?.length > 0 ? getBedtimeDrugLevel(events, targetBedtime, halfLife, 5, minMg) : 0;
  if (minMg != null) level = applyCaffeineMgFloor(level);

  return {
    level,
    bedtimeAt: targetBedtime.toISOString(),
  };
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs();

  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the environment or .env.local'
    );
    process.exit(1);
  }

  let oldDrugAmounts = null;
  if (opts.oldDrugAmountsPath) {
    const raw = readFileSync(opts.oldDrugAmountsPath, 'utf8');
    oldDrugAmounts = JSON.parse(raw);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const habits = await fetchCaffeineHabits(supabase, opts.habitId);
  if (!habits.length) {
    console.log('No caffeine quick_consumption habits found.');
    process.exit(0);
  }

  const habitIds = habits.map((h) => h.id);
  const habitsById = new Map(habits.map((h) => [h.id, h]));
  const { byId: optionsById, byHabitAndName } = await fetchOptionsByHabit(supabase, habitIds);

  const events = await fetchAllEventsForHabits(supabase, habitIds, opts.limitEvents);
  console.log(`Loaded ${events.length} consumption events for ${habits.length} caffeine habit(s).`);

  const updates = [];
  let skipped = 0;
  let unchanged = 0;

  for (const ev of events) {
    const option = resolveOptionForEvent(ev, habitsById, optionsById, byHabitAndName);
    if (!option) {
      skipped++;
      continue;
    }

    const habit = habitsById.get(ev.habit_id);
    const newAmount = computeNewAmount(ev, option, habit.name, opts.measurementRegion, oldDrugAmounts);
    if (newAmount == null) {
      console.warn(`Skip event ${ev.id}: could not compute amount (no volume/refVolume and no --old-drug-amounts for option ${option.id})`);
      skipped++;
      continue;
    }

    const prev = Number(ev.amount);
    if (Math.abs(prev - newAmount) < 0.05) {
      unchanged++;
      continue;
    }

    updates.push({
      id: ev.id,
      amount: newAmount,
      user_id: ev.user_id,
      habit_id: ev.habit_id,
      consumed_at: ev.consumed_at,
    });
  }

  console.log(`Planned updates: ${updates.length}, unchanged: ${unchanged}, skipped (no option): ${skipped}`);

  if (opts.dryRun) {
    console.log('[dry-run] First 20 updates:', updates.slice(0, 20));
    process.exit(0);
  }

  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const u of batch) {
      const { error } = await supabase.from('habit_consumption_events').update({ amount: u.amount }).eq('id', u.id);
      if (error) {
        console.error(`Failed to update event ${u.id}:`, error.message);
        process.exit(1);
      }
    }
    console.log(`Updated events ${i + 1}–${Math.min(i + batchSize, updates.length)}`);
  }

  // Recompute drug_levels for affected user/habit from min log date - 7d through max existing row
  const affectedPairs = new Map();
  for (const u of updates) {
    const key = `${u.user_id}::${u.habit_id}`;
    if (!affectedPairs.has(key)) affectedPairs.set(key, []);
    affectedPairs.get(key).push(u);
  }

  const { data: usersData } = await supabase.from('users').select('id, timezone, notification_time');
  const userById = new Map((usersData || []).map((u) => [u.id, u]));

  for (const [key, evs] of affectedPairs) {
    const [userId, habitId] = key.split('::');
    const habit = habitsById.get(habitId);
    if (!habit) continue;

    const tz = userById.get(userId)?.timezone || 'UTC';

    const logDates = evs.map((e) => localDateInTz(e.consumed_at, tz));
    let minD = logDates.reduce((a, b) => (a < b ? a : b));
    const [y, m, d] = minD.split('-').map(Number);
    const from = new Date(y, m - 1, d - 7);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;

    const { data: levelRows } = await supabase
      .from('drug_levels')
      .select('date')
      .eq('user_id', userId)
      .eq('habit_id', habitId)
      .gte('date', fromStr)
      .order('date', { ascending: true });

    const dates = (levelRows || []).map((r) => r.date);
    if (dates.length === 0) {
      console.log(`No drug_levels rows for user ${userId} habit ${habitId} from ${fromStr}; skipping level recompute.`);
      continue;
    }

    console.log(`Recomputing ${dates.length} drug_levels row(s) for user ${userId} habit ${habit.name} (${habitId})`);

    for (const dateStr of dates) {
      const { level, bedtimeAt } = await recomputeDrugLevelForDate(supabase, userId, habit, dateStr, tz);
      const { error: upErr } = await supabase
        .from('drug_levels')
        .update({
          level_value: level,
          calculated_at: new Date().toISOString(),
          ...(bedtimeAt ? { bedtime_at: bedtimeAt } : {}),
        })
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .eq('date', dateStr);

      if (upErr) {
        console.error(`drug_levels update failed ${userId} ${dateStr}:`, upErr.message);
        process.exit(1);
      }
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
