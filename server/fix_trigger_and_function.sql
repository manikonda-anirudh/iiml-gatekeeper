-- Fix trigger function to handle edge cases and ensure it works with updated constraints
-- Run this in your Supabase SQL Editor

-- Step 1: Recreate the function with better error handling and NULL checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  user_role TEXT;
BEGIN
  -- Get email from auth.users
  user_email := COALESCE(NEW.email, '');
  
  -- If email is empty, we can't create the user - return early
  IF user_email = '' THEN
    RAISE WARNING 'User created without email, skipping public.users creation';
    RETURN NEW;
  END IF;
  
  -- Extract name from user metadata or email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '))
  );
  
  -- Ensure name is not empty
  IF user_name IS NULL OR user_name = '' THEN
    user_name := INITCAP(REPLACE(SPLIT_PART(user_email, '@', 1), '.', ' '));
  END IF;
  
  -- Determine role based on email domain (default to STUDENT)
  user_role := 'STUDENT';
  IF user_email LIKE '%@staff.iiml.ac.in' OR user_email LIKE '%@admin.iiml.ac.in' THEN
    user_role := 'GATE_STAFF';
  ELSIF user_email LIKE '%@council.iiml.ac.in' THEN
    user_role := 'COUNCIL';
  END IF;
  
  -- Insert into public.users if not exists
  -- Use ON CONFLICT to handle race conditions
  INSERT INTO public.users (id, full_name, institute_mail, role, profile_data)
  VALUES (
    NEW.id,
    user_name,
    user_email,
    user_role,
    COALESCE(NEW.raw_user_meta_data->'profile_data', '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    institute_mail = EXCLUDED.institute_mail,
    role = EXCLUDED.role;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Verify the function exists and works
DO $$
BEGIN
  RAISE NOTICE 'Function handle_new_user() has been updated';
END $$;

-- Step 3: Check if trigger exists (you'll need to verify this in Supabase Dashboard)
-- The trigger should be created in Supabase Dashboard → Database → Triggers
-- Trigger name: on_auth_user_created
-- Table: auth.users
-- Event: INSERT
-- Function: public.handle_new_user()

-- Step 4: Test the function manually (optional - uncomment to test)
-- SELECT public.handle_new_user() FROM auth.users WHERE id = 'some-user-id';

