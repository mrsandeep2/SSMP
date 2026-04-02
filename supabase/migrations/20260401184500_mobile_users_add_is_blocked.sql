-- Ensure blocked-user check is available for Firebase mobile users.
ALTER TABLE public.mobile_users
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
