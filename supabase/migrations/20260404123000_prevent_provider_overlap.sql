-- Prevent providers from holding multiple bookings at the same date/time.

CREATE OR REPLACE FUNCTION public.prevent_provider_time_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  conflict_count INTEGER := 0;
BEGIN
  IF NEW.provider_id IS NULL OR NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(1)
  INTO conflict_count
  FROM public.bookings b
  WHERE b.provider_id = NEW.provider_id
    AND b.id <> COALESCE(NEW.id, gen_random_uuid())
    AND b.scheduled_date = NEW.scheduled_date
    AND b.scheduled_time = NEW.scheduled_time
    AND COALESCE(b.status, 'pending') NOT IN ('cancelled', 'completed', 'disputed');

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'provider already has a booking at this date and time';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_provider_time_overlap ON public.bookings;

CREATE TRIGGER trg_prevent_provider_time_overlap
BEFORE INSERT OR UPDATE OF provider_id, scheduled_date, scheduled_time, status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_provider_time_overlap();
