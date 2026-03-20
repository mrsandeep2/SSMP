-- Store OneSignal player_id per user for direct native targeting.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_player_id
ON public.profiles (onesignal_player_id)
WHERE onesignal_player_id IS NOT NULL;