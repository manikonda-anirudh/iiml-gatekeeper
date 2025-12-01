-- Diagnostic script to check trigger and function setup
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if the function exists
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 2. Check if the trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  tgisinternal as is_internal
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created' 
   OR tgname LIKE '%auth_user%';

-- 3. Check the users table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. Check role constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname LIKE '%role%';

-- 5. Check recent errors in Supabase logs (if accessible)
-- You can also check Supabase Dashboard → Logs → Postgres Logs

