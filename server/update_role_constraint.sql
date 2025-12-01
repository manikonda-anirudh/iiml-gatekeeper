-- Migration script to update role constraint to match codebase
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the old constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update existing data to match new role values
-- Map: 'student' -> 'STUDENT', 'security' -> 'GATE_STAFF', 'admin' -> 'COUNCIL'
UPDATE public.users 
SET role = 'STUDENT' 
WHERE role = 'student';

UPDATE public.users 
SET role = 'GATE_STAFF' 
WHERE role = 'security';

UPDATE public.users 
SET role = 'COUNCIL' 
WHERE role = 'admin';

-- Step 3: Add new constraint with correct role values
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (
  role = ANY (
    ARRAY['STUDENT'::text, 'GATE_STAFF'::text, 'COUNCIL'::text]
  )
);

-- Step 4: Update default value
ALTER TABLE public.users 
ALTER COLUMN role SET DEFAULT 'STUDENT'::text;

-- Verify the changes
SELECT DISTINCT role FROM public.users;

