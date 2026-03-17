-- Add location column for services (city / area / locality)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS location TEXT;

