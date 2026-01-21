# Server-Side Insights Implementation

This document describes the new server-side insights computation system that replaces on-device computation.

## Overview

The app now uses a server-side architecture where insights are pre-computed daily by Supabase Edge Functions and stored in the database. This eliminates race conditions, improves performance, and ensures a consistent user experience.

## Architecture

### Components

1. **Database Tables**:
   - `insights`: Stores pre-computed insights (correlations, bedtime consistency)
   - `insight_computation_log`: Tracks computation runs and status
   - `latest_insights`: View for querying the most recent insights per habit

2. **Edge Functions**:
   - `compute-insights`: Processes insights for active users daily
   - Triggered by GitHub Actions cron job at 3 AM UTC

3. **Client Services**:
   - `precomputedInsightsService.js`: Fetches pre-computed insights from the database
   - `insightsService.js`: Legacy on-device computation (kept as fallback)
   - `sleepSyncService.js`: Enhanced with mutex to prevent race conditions

4. **Scheduled Computation**:
   - GitHub Actions workflow runs daily at 3 AM UTC
   - Calls the `compute-insights` edge function
   - Only processes users with recent activity (logged habits or sleep data)

## Setup Instructions

### 1. GitHub Actions Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://alskvzepqyqnchgdltrv.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (from Project Settings → API)

### 2. Database Migrations

The following migrations have been applied:

- `20250122000000_create_insights_table.sql`: Creates the insights table and view
- `20250122000001_setup_insights_cron.sql`: Sets up computation logging

### 3. Edge Function Deployment

The `compute-insights` function has been deployed and is ready to use.

## How It Works

### Daily Computation Flow

1. **GitHub Actions triggers** the `compute-insights` edge function at 3 AM UTC
2. **Active users are identified**: Users who logged habits or synced sleep data in the last 24 hours
3. **Insights are computed** for each active user:
   - Correlation analysis between habits and sleep metrics
   - Bedtime consistency scoring
4. **Results are stored** in the `insights` table
5. **Computation is logged** in the `insight_computation_log` table

### Client-Side Flow

1. **User opens Insights screen**
2. **App fetches pre-computed insights** from the database (no computation)
3. **Insights are displayed** immediately
4. **Placeholders shown** for habits without sufficient data

## Key Improvements

### 1. Race Condition Prevention

**Problem**: Users could log habits before sleep data was synced, causing crashes.

**Solution**: 
- Sleep sync uses a mutex to prevent concurrent operations
- Habit logging is independent and doesn't require sleep data
- Insights are computed server-side asynchronously

### 2. Performance

**Before**: On-device computation could take 5-10 seconds
**After**: Insights load instantly from the database

### 3. Consistency

**Before**: Different devices might compute slightly different insights
**After**: All users see identical insights computed by the same algorithm

### 4. Battery Life

**Before**: Heavy computation on device drained battery
**After**: Minimal processing on device

## Migration Strategy

The app supports both pre-computed and on-device insights:

1. **Default**: Uses pre-computed insights from the database
2. **Fallback**: If no pre-computed insights exist, falls back to on-device computation
3. **Toggle**: `usePrecomputed` state can switch between modes for testing

## Testing

### Manual Trigger

You can manually trigger insight computation via GitHub Actions:

1. Go to Actions → "Compute Insights Daily"
2. Click "Run workflow"
3. Select branch and run

### Check Computation Status

Query the database to check the last computation:

```sql
SELECT * FROM public.last_insight_computation;
```

### Verify Insights

```sql
-- Check insights for a specific user
SELECT * FROM public.insights WHERE user_id = '<user_id>';

-- Check latest insights
SELECT * FROM public.latest_insights WHERE user_id = '<user_id>';
```

## Monitoring

### Computation Logs

View computation history:

```sql
SELECT 
  started_at,
  completed_at,
  status,
  users_processed,
  insights_computed,
  error_message
FROM public.insight_computation_log
ORDER BY started_at DESC
LIMIT 10;
```

### GitHub Actions Logs

Check the workflow runs in GitHub Actions to see:
- Execution time
- HTTP response codes
- Any errors

## Troubleshooting

### Issue: No insights showing up

**Check**:
1. Has the daily computation run? Check `insight_computation_log`
2. Does the user have sufficient data? (minimum 10 data points)
3. Check the edge function logs in Supabase dashboard

### Issue: Computation failing

**Check**:
1. GitHub Actions secrets are configured correctly
2. Edge function is deployed: `npx supabase functions deploy compute-insights`
3. Check Supabase Edge Function logs for errors

### Issue: Old on-device computation still running

**Solution**:
- Set `usePrecomputed = true` in InsightsScreen.js (should be default)
- Clear AsyncStorage cache if necessary

## Future Enhancements

1. **Real-time updates**: Add webhooks to trigger computation when users sync data
2. **Personalized scheduling**: Compute at optimal times for each user's timezone
3. **Progressive computation**: Compute insights incrementally as new data arrives
4. **Insight notifications**: Push notifications when significant insights are found

## Developer Notes

### Adding New Insight Types

1. Update the insight_type CHECK constraint in the database
2. Add computation logic to `compute-insights/index.ts`
3. Add transformation logic to `precomputedInsightsService.js`
4. Update UI components if needed

### Modifying Computation Logic

1. Edit `supabase/functions/compute-insights/index.ts`
2. Deploy: `npx supabase functions deploy compute-insights`
3. Test with manual trigger in GitHub Actions

### Database Schema

```sql
-- Insights table structure
CREATE TABLE public.insights (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    habit_id UUID,  -- NULL for user-level insights
    insight_type TEXT NOT NULL,  -- 'correlation' or 'bedtime_consistency'
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    insight_data JSONB NOT NULL,  -- All computed metrics
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

## Support

For issues or questions, check:
- Supabase Dashboard → Edge Functions → Logs
- GitHub Actions → Workflow runs
- Database → `insight_computation_log` table
