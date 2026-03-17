-- Fix: booking_events trigger function must bypass RLS so any authenticated
-- user creating/updating a booking can log the event without an INSERT policy.

CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
