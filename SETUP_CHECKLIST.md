# Setup Checklist for Server-Side Insights

## ✅ Completed (Already Done)

- [x] Created database tables (`insights`, `insight_computation_log`)
- [x] Created database view (`latest_insights`)
- [x] Updated edge function (`compute-insights`)
- [x] Deployed edge function to Supabase
- [x] Created new client service (`precomputedInsightsService.js`)
- [x] Updated InsightsScreen to use pre-computed insights
- [x] Added sync mutex to prevent race conditions
- [x] Created GitHub Actions workflow file
- [x] Tested edge function (working!)

## ⏳ To Do (Requires Your Action)

### 1. Configure GitHub Secrets (5 minutes)

**Why:** Enables automated daily insight computation

**Steps:**

1. Open your Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/settings/api
   - Find the **"service_role"** key (NOT the anon key)
   - Copy it to your clipboard

2. Go to your GitHub Repository:
   - Navigate to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
   - Click "New repository secret"

3. Add First Secret:
   - Name: `SUPABASE_URL`
   - Value: `https://alskvzepqyqnchgdltrv.supabase.co`
   - Click "Add secret"

4. Add Second Secret:
   - Click "New repository secret" again
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [Paste the service_role key you copied in step 1]
   - Click "Add secret"

✅ Done! The workflow can now run automatically.

---

### 2. Test the Workflow (2 minutes)

**Why:** Verify everything works before the automatic run

**Steps:**

1. Go to GitHub Actions:
   - Navigate to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
   - Click on "Compute Insights Daily" workflow

2. Trigger Manually:
   - Click "Run workflow" button (top right)
   - Select your main branch
   - Click "Run workflow"

3. Watch it Run:
   - Click on the running workflow to see live logs
   - Should complete in under 1 minute
   - Should show "✅ Insights computation completed successfully"

✅ If successful, you're all set!

---

### 3. Verify in the App (5 minutes)

**Why:** Ensure users are seeing pre-computed insights

**Steps:**

1. Open the app on your device

2. Navigate to the Insights screen

3. Check that:
   - Insights load instantly (no waiting/computation)
   - Data looks correct
   - No error messages appear

4. (Optional) Check the database:
   - Go to Supabase Dashboard → Table Editor
   - Look at the `insights` table
   - Should see new rows with today's date

✅ If insights appear quickly, it's working!

---

### 4. Monitor First Automatic Run (Next Day)

**Why:** Confirm the daily automation works

**Steps:**

1. Wait until after 3 AM UTC (converts to your timezone):
   - PST: 7 PM previous day
   - EST: 10 PM previous day
   - GMT: 3 AM
   - CET: 4 AM

2. Check GitHub Actions:
   - Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
   - Look for "Compute Insights Daily" runs
   - Should see a scheduled run

3. Verify Results:
   - Check that it completed successfully
   - Open app and verify insights updated

✅ If successful, automation is working!

---

## Troubleshooting

### Issue: Workflow fails with "unauthorized"

**Fix:** Check that the `SUPABASE_SERVICE_ROLE_KEY` is correct
- Go back to Supabase Dashboard
- Make sure you copied the **service_role** key, not the **anon** key
- Update the secret in GitHub

### Issue: No insights showing in app

**Check:**
1. Has the workflow run? Look at GitHub Actions
2. Are there rows in the `insights` table? Check Supabase dashboard
3. Does the user have enough data? (Need 10+ habit logs with matching sleep data)

**Fix:**
- Manually trigger the workflow
- Wait a few minutes
- Refresh the Insights screen in the app

### Issue: App still computing on-device

**Fix:** Make sure `usePrecomputed` is set to `true` in InsightsScreen.js:

```javascript
const [usePrecomputed, setUsePrecomputed] = useState(true); // Should be true
```

---

## Quick Reference

### Important URLs

- **GitHub Actions:** `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
- **Supabase Dashboard:** `https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv`
- **Supabase API Settings:** `https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv/settings/api`

### Important Files

- **Workflow:** `.github/workflows/compute-insights.yml`
- **Edge Function:** `supabase/functions/compute-insights/index.ts`
- **Client Service:** `services/precomputedInsightsService.js`
- **Insights Screen:** `screens/InsightsScreen.js`

### Database Tables

- **Pre-computed insights:** `public.insights`
- **Latest insights:** `public.latest_insights` (view)
- **Computation logs:** `public.insight_computation_log`

---

## Success Criteria

You'll know everything is working when:

- ✅ GitHub Actions shows successful scheduled runs
- ✅ Insights screen loads instantly (< 1 second)
- ✅ No app crashes when logging habits
- ✅ `insight_computation_log` table shows regular entries
- ✅ Users see consistent insights across devices

---

## Need Help?

If you run into issues:

1. Check the error message in GitHub Actions logs
2. Check Supabase Edge Function logs
3. Query `insight_computation_log` for error details:
   ```sql
   SELECT * FROM public.insight_computation_log 
   ORDER BY started_at DESC LIMIT 5;
   ```

---

**Estimated Total Setup Time:** 15 minutes
**Priority:** High (enables automated insights)
**Difficulty:** Easy (mostly copy-paste)
