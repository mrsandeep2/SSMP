-- Enforce valid booking status transitions at database level.

CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('on_the_way', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'on_the_way' AND NEW.status IN ('arrived', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'arrived' AND NEW.status IN ('started', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'started' AND NEW.status IN ('completed', 'cancelled', 'disputed') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid booking status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_status_transition ON public.bookings;

CREATE TRIGGER enforce_booking_status_transition
BEFORE UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_status_transition();
