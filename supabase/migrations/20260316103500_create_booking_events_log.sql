-- Audit table for booking lifecycle and status changes.

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id_created_at
ON public.booking_events (booking_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_events (
      booking_id,
      actor_id,
      event_type,
      to_status,
      metadata
    ) VALUES (
      NEW.id,
      auth.uid(),
      'created',
      NEW.status,
      jsonb_build_object(
        'service_id', NEW.service_id,
        'provider_id', NEW.provider_id,
        'seeker_id', NEW.seeker_id,
        'amount', NEW.amount
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.booking_events (
        booking_id,
        actor_id,
        event_type,
        from_status,
        to_status,
        metadata
      ) VALUES (
        NEW.id,
        auth.uid(),
        'status_changed',
        OLD.status,
        NEW.status,
        '{}'::jsonb
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_booking_events_insert'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_booking_events_insert
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.log_booking_event();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_booking_events_update'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_booking_events_update
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.log_booking_event();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_events'
      AND policyname = 'Participants can view booking events'
  ) THEN
    CREATE POLICY "Participants can view booking events"
      ON public.booking_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.id = booking_id
            AND (b.seeker_id = auth.uid() OR b.provider_id = auth.uid())
        )
      );
  END IF;
END;
$$;
