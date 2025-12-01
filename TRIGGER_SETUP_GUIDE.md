# Trigger Setup Guide - Fixing "Database error saving new user"

## Problem

When signing up with a new account, you're getting:
```
Database error saving new user
```

This happens because the trigger that creates a user in `public.users` when a new user signs up in `auth.users` is either:
1. Not configured properly
2. Failing due to constraint violations
3. Missing required fields

## Solution Steps

### Step 1: Update the Trigger Function

Run `server/fix_trigger_and_function.sql` in your Supabase SQL Editor. This will:
- Recreate the `handle_new_user()` function with better error handling
- Add NULL checks to prevent constraint violations
- Ensure role values match the updated constraint

### Step 2: Verify the Trigger Exists

1. Go to your **Supabase Dashboard**
2. Navigate to **Database** → **Triggers**
3. Look for a trigger named `on_auth_user_created` on the `auth.users` table

**If the trigger doesn't exist, create it:**

1. Click **"New Trigger"** or **"Create Trigger"**
2. Configure as follows:
   - **Name**: `on_auth_user_created`
   - **Table**: `auth.users`
   - **Events**: `INSERT`
   - **Trigger type**: `AFTER`
   - **Function**: `public.handle_new_user`
   - **Enable trigger**: ✅ Yes

### Step 3: Run Diagnostic Script

Run `server/check_trigger_setup.sql` to verify:
- Function exists and is correct
- Trigger is properly configured
- Table constraints are correct

### Step 4: Test the Fix

1. Try signing up with a new account again
2. Check if the user appears in `public.users` table
3. Verify the role is set correctly (`STUDENT`, `GATE_STAFF`, or `COUNCIL`)

## Common Issues

### Issue 1: Trigger Not Created
**Symptom**: Users are created in `auth.users` but not in `public.users`

**Solution**: Create the trigger as described in Step 2 above.

### Issue 2: Constraint Violation
**Symptom**: Error mentions constraint violation

**Solution**: 
- Run `server/fix_trigger_and_function.sql` to update the function
- Ensure all required fields have defaults or are provided

### Issue 3: NULL Values
**Symptom**: Error mentions NULL values in required fields

**Solution**: The updated function now handles NULL values better. Make sure:
- Email is always provided (Supabase requires this)
- Name is extracted from email if metadata is missing

## Manual User Creation (Temporary Workaround)

If the trigger still doesn't work, you can manually sync users:

```sql
-- Sync a specific user
SELECT public.sync_user_from_auth(
  'user-id-here'::uuid,
  'user@email.com'
);

-- Or sync all existing users
SELECT public.sync_existing_users();
```

## Verification

After fixing, verify everything works:

```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';

-- Check if trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Test: Create a test user and check if it appears in public.users
-- (Sign up via your app, then check)
SELECT * FROM public.users ORDER BY created_at DESC LIMIT 5;
```

