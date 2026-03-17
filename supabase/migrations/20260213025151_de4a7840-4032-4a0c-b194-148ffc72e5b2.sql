
-- Fix the default approval_status to 'pending' so new services require admin approval
ALTER TABLE public.services ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Enable realtime for services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'services'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
  END IF;
END $$;
