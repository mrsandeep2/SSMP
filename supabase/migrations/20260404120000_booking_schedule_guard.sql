-- Prevent booking with past dates or times.

CREATE OR REPLACE FUNCTION public.validate_booking_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  scheduled_ts TIMESTAMPTZ;
BEGIN
  IF NEW.scheduled_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.scheduled_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'scheduled_date must be today or in the future';
  END IF;

  IF NEW.scheduled_time IS NULL OR length(trim(NEW.scheduled_time)) = 0 THEN
    RETURN NEW;
  END IF;

  scheduled_ts := to_timestamp(
    NEW.scheduled_date::text || ' ' || NEW.scheduled_time,
    'YYYY-MM-DD HH:MI AM'
  );

  IF NEW.scheduled_date = CURRENT_DATE AND scheduled_ts < now() THEN
    RAISE EXCEPTION 'scheduled_time must be in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_booking_schedule ON public.bookings;

CREATE TRIGGER trg_validate_booking_schedule
BEFORE INSERT OR UPDATE OF scheduled_date, scheduled_time ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_schedule();
