-- ============================================================
-- Live tracking, commission split, and review RLS policies
-- ============================================================

-- 1. provider_locations: stores the provider's last known position per active booking
CREATE TABLE IF NOT EXISTS public.provider_locations (
  provider_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  heading     NUMERIC(6,2),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;

-- Provider writes their own location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_locations' AND policyname = 'providers_write_own_location'
  ) THEN
    CREATE POLICY "providers_write_own_location"
      ON public.provider_locations
      FOR ALL
      USING  (auth.uid() = provider_id)
      WITH CHECK (auth.uid() = provider_id);
  END IF;
END;
$$;

-- Seekers who have an active (on_the_way / arrived) booking with this provider can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_locations' AND policyname = 'seekers_read_active_provider_location'
  ) THEN
    CREATE POLICY "seekers_read_active_provider_location"
      ON public.provider_locations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id = provider_locations.booking_id
            AND b.seeker_id = auth.uid()
            AND b.status IN ('on_the_way', 'arrived')
        )
      );
  END IF;
END;
$$;

-- Admins can read all locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_locations' AND policyname = 'admin_read_all_locations'
  ) THEN
    CREATE POLICY "admin_read_all_locations"
      ON public.provider_locations
      FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

-- Enable realtime on provider_locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations;
  END IF;
END;
$$;


-- 2. Add commission tracking columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_earnings NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS platform_earnings NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS commission_rate    NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS booking_location_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS booking_location_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS booking_address TEXT;


-- 3. RLS policies for the existing reviews table
--    (table created in first migration; policies may be absent)

-- Anyone authenticated can read reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reviews' AND policyname = 'anyone_read_reviews'
  ) THEN
    CREATE POLICY "anyone_read_reviews"
      ON public.reviews
      FOR SELECT
      USING (true);
  END IF;
END;
$$;

-- Seekers can insert a review for their own completed booking (one per booking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reviews' AND policyname = 'seeker_insert_review'
  ) THEN
    CREATE POLICY "seeker_insert_review"
      ON public.reviews
      FOR INSERT
      WITH CHECK (
        auth.uid() = seeker_id
        AND EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id = reviews.booking_id
            AND b.seeker_id = auth.uid()
            AND b.status = 'completed'
        )
      );
  END IF;
END;
$$;
