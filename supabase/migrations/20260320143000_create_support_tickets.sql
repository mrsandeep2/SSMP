-- Production support ticketing foundation with moderation-first routing.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('help', 'complaint', 'feedback')),
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  route_target TEXT NOT NULL DEFAULT 'admin' CHECK (route_target IN ('faq', 'admin', 'provider', 'system')),
  assigned_to UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_role public.app_role NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'awaiting_user', 'assigned', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_created_at
  ON public.support_tickets (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority_created_at
  ON public.support_tickets (status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to_status
  ON public.support_tickets (assigned_to, status)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_booking_id
  ON public.support_tickets (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_support_tickets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status IN ('resolved', 'closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_tickets_updated_at ON public.support_tickets;

CREATE TRIGGER trg_touch_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.touch_support_tickets_updated_at();

CREATE OR REPLACE FUNCTION public.route_support_ticket_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _booking_provider UUID;
BEGIN
  -- Complaint always starts with Admin moderation.
  IF NEW.type = 'complaint' THEN
    NEW.route_target := 'admin';
    IF NEW.status = 'open' THEN
      NEW.status := 'in_review';
    END IF;
  ELSIF NEW.type = 'help' THEN
    -- Default to FAQ/system routing first; admin can take over later.
    IF NEW.route_target IS NULL OR NEW.route_target = 'admin' THEN
      NEW.route_target := 'faq';
    END IF;
  ELSIF NEW.type = 'feedback' THEN
    -- Feedback is primarily for analytics/system intake.
    NEW.route_target := 'system';
  END IF;

  -- If booking context is present, capture provider context for admin audit handling.
  IF NEW.booking_id IS NOT NULL AND NEW.provider_id IS NULL THEN
    SELECT b.provider_id
    INTO _booking_provider
    FROM public.bookings b
    WHERE b.id = NEW.booking_id;

    NEW.provider_id := _booking_provider;
  END IF;

  -- Provider may only receive tickets after explicit assignment.
  IF NEW.assigned_role = 'provider' THEN
    NEW.route_target := 'provider';
    IF NEW.status = 'open' THEN
      NEW.status := 'assigned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_support_ticket_defaults ON public.support_tickets;

CREATE TRIGGER trg_route_support_ticket_defaults
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.route_support_ticket_defaults();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Users can create own support tickets'
  ) THEN
    CREATE POLICY "Users can create own support tickets"
      ON public.support_tickets
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = created_by);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Users can read own support tickets'
  ) THEN
    CREATE POLICY "Users can read own support tickets"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (auth.uid() = created_by);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Assigned providers can read involved support tickets'
  ) THEN
    CREATE POLICY "Assigned providers can read involved support tickets"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (
        assigned_role = 'provider'
        AND assigned_to = auth.uid()
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND policyname = 'Admins can manage all support tickets'
  ) THEN
    CREATE POLICY "Admins can manage all support tickets"
      ON public.support_tickets
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;
