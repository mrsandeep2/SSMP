-- Store Firebase phone-auth users in Supabase with role mapping.
CREATE TABLE IF NOT EXISTS public.mobile_users (
  firebase_uid text PRIMARY KEY,
  phone text UNIQUE NOT NULL,
  name text,
  role public.app_role NOT NULL DEFAULT 'seeker',
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_mobile_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mobile_users_updated_at ON public.mobile_users;
CREATE TRIGGER trg_mobile_users_updated_at
BEFORE UPDATE ON public.mobile_users
FOR EACH ROW
EXECUTE FUNCTION public.update_mobile_users_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_users'
      AND policyname = 'Public can read mobile users'
  ) THEN
    CREATE POLICY "Public can read mobile users"
      ON public.mobile_users
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_users'
      AND policyname = 'Public can insert mobile users'
  ) THEN
    CREATE POLICY "Public can insert mobile users"
      ON public.mobile_users
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (firebase_uid <> '' AND phone <> '');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mobile_users'
      AND policyname = 'Public can update mobile users'
  ) THEN
    CREATE POLICY "Public can update mobile users"
      ON public.mobile_users
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (firebase_uid <> '' AND phone <> '');
  END IF;
END
$$;
