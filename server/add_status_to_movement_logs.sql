-- Migration: Add status column to movement_logs table
-- This enables the "Live Request" system for student entry/exit

-- Add status column with default 'COMPLETED' for existing records
ALTER TABLE public.movement_logs 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'COMPLETED';

-- Add check constraint for valid statuses
ALTER TABLE public.movement_logs
DROP CONSTRAINT IF EXISTS movement_logs_status_check;

ALTER TABLE public.movement_logs
ADD CONSTRAINT movement_logs_status_check 
CHECK (status IN ('PENDING', 'COMPLETED'));

-- Set existing records with gate_user_id = NULL to PENDING (if any)
UPDATE public.movement_logs 
SET status = 'PENDING' 
WHERE gate_user_id IS NULL;

-- Set existing records with gate_user_id != NULL to COMPLETED
UPDATE public.movement_logs 
SET status = 'COMPLETED' 
WHERE gate_user_id IS NOT NULL;

-- Create index for filtering pending requests
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.movement_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_student_status ON public.movement_logs(student_id, status) 
WHERE entity_type = 'STUDENT' AND status = 'PENDING';

