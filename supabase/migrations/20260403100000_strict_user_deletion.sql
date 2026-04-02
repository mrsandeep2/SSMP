-- Ensure profiles -> auth.users cascade is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure user_roles -> profiles cascade is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_profiles_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure services -> profiles cascade is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_provider_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_provider_id_profiles_fkey
      FOREIGN KEY (provider_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure bookings -> profiles cascade is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_seeker_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_seeker_id_profiles_fkey
      FOREIGN KEY (seeker_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_provider_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_provider_id_profiles_fkey
      FOREIGN KEY (provider_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.delete_user_completely(OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profile_delete ON public.profiles;
CREATE TRIGGER trigger_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_delete();
