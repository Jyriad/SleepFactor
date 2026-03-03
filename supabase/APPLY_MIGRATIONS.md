# Applying migrations before beta

Run these so your beta database schema matches the app (consumption options consolidation, exercise duration rename, etc.).

## Option A: Supabase CLI (recommended)

From the **project root** (SleepFactor folder):

```bash
npx supabase db push
```

Ensure the project is linked to your Supabase project (`npx supabase link` if needed). This applies all pending migrations in order.

## Option B: Run SQL manually in Supabase Dashboard

In Supabase Dashboard → SQL Editor, run each migration file **in this order** (oldest first). Skip any you have already applied.

1. `20250101000000_initial_schema.sql`
2. … (all migrations in timestamp order up to …)
3. `20260302000000_consolidate_consumption_options_canonical.sql`
4. `20260302100000_backfill_consumption_options_default_volume.sql`
5. `20260303000000_rename_exercise_time_to_exercise_duration.sql`

If your database is already up to date through `20260220000000`, run only the last three files above (3–5).

## After running

- Confirm in Table Editor that `consumption_options` has one canonical row per (habit_id, name) for system options.
- Confirm column rename: `exercise_time_before_bed` → `exercise_duration_minutes` if your app uses it.
