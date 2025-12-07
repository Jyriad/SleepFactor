# Supabase Setup Guide

## ✅ What's Been Completed

1. **Supabase CLI installed** - Installed locally as a dev dependency
2. **Project linked** - Connected to your Supabase project (SleepFactor)
3. **Supabase client library** - Installed `@supabase/supabase-js`
4. **Configuration files created** - Set up Supabase client service

## 📁 Files Created

- `services/supabase.js` - Main Supabase client for database operations
- `config/supabase.js` - Configuration file with your project URL and API keys

## 🔑 Your Supabase Credentials

- **Project URL**: `https://alskvzepqyqnchgdltrv.supabase.co`
- **Project ID**: `alskvzepqyqnchgdltrv`
- **Anon Key**: Already configured in `config/supabase.js`

**⚠️ Important**: The service_role key should NEVER be used in client-side code. It has admin privileges and should only be used in secure server-side environments.

## 🚀 Using Supabase CLI

You can now use the Supabase CLI from your terminal:

```bash
# View your projects
npx supabase projects list

# Link to a project (already done)
npx supabase link --project-ref alskvzepqyqnchgdltrv

# View database tables
npx supabase db tables

# Run SQL queries
npx supabase db query "SELECT * FROM your_table;"

# Create a migration
npx supabase migration new your_migration_name

# Apply migrations
npx supabase db push
```

## 💻 Using Supabase in Your App

Import the Supabase client in any file:

```javascript
import { supabase } from './services/supabase';

// Example: Query data
const { data, error } = await supabase
  .from('habits')
  .select('*');

// Example: Insert data
const { data, error } = await supabase
  .from('habit_logs')
  .insert([
    { user_id: '...', habit_id: '...', date: '2025-01-01', value: 'yes' }
  ]);
```

## 🔐 Environment Variables (Optional)

If you prefer to use environment variables instead of hardcoded values:

1. Create a `.env.local` file in the project root (already in `.gitignore`)
2. Add your credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://alskvzepqyqnchgdltrv.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```
3. The config file will automatically use these values if they exist

## 📊 Next Steps

1. Create your database schema (tables for users, habits, habit_logs, sleep_data, etc.)
2. Set up authentication
3. Start building your app screens

You can manage your database directly from:
- Supabase Dashboard: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv
- Cursor (via Supabase CLI commands)
- Your code (using the Supabase client)

## 🔗 Useful Links

- Supabase Dashboard: https://supabase.com/dashboard/project/alskvzepqyqnchgdltrv
- Supabase Docs: https://supabase.com/docs
- Supabase CLI Docs: https://supabase.com/docs/reference/cli

