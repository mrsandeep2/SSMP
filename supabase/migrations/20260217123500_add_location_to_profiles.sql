-- Add location column to profiles for seekers/providers
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location TEXT;

