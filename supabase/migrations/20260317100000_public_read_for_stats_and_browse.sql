-- Allow unauthenticated (anon) reads so the landing page stats and
-- service marketplace show real data without requiring a login.

-- profiles: anon can read any profile
-- (needed to resolve provider availability for stats + service list)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Public anon can view profiles'
  ) THEN
    CREATE POLICY "Public anon can view profiles"
      ON public.profiles FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- user_roles: anon can read roles
-- (needed to distinguish providers from seekers for the provider count stat)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'Public anon can view roles'
  ) THEN
    CREATE POLICY "Public anon can view roles"
      ON public.user_roles FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- bookings: anon can see completed bookings (count only used in stats)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'Public anon can view completed bookings'
  ) THEN
    CREATE POLICY "Public anon can view completed bookings"
      ON public.bookings FOR SELECT TO anon USING (status = 'completed');
  END IF;
END $$;
