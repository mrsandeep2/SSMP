-- Prevent providers from accepting/rescheduling overlapping bookings
-- in the same date + time slot.

CREATE OR REPLACE FUNCTION public.prevent_provider_slot_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only enforce for active provider-work statuses.
  IF NEW.status NOT IN ('accepted', 'on_the_way', 'arrived', 'started', 'confirmed', 'in_progress') THEN
    RETURN NEW;
  END IF;

  -- If slot is not set yet, skip conflict check.
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id <> NEW.id
      AND b.provider_id = NEW.provider_id
      AND b.scheduled_date = NEW.scheduled_date
      AND b.scheduled_time = NEW.scheduled_time
      AND b.status IN ('accepted', 'on_the_way', 'arrived', 'started', 'confirmed', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Provider already has a booking for % at %.', NEW.scheduled_date, NEW.scheduled_time;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_provider_slot_overlap ON public.bookings;

CREATE TRIGGER trg_prevent_provider_slot_overlap
BEFORE UPDATE OF status, scheduled_date, scheduled_time, provider_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_provider_slot_overlap();
