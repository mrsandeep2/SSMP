-- Keep service rating/review_count in sync with reviews in real time.

-- 1) Prevent duplicate review per booking.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_booking_id
ON public.reviews (booking_id);

-- 2) Validate review booking ownership and completion.
CREATE OR REPLACE FUNCTION public.validate_review_booking_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT id, seeker_id, provider_id, service_id, status
  INTO b
  FROM public.bookings
  WHERE id = NEW.booking_id;

  IF b.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found for review';
  END IF;

  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'You can rate only after service completion';
  END IF;

  IF NEW.seeker_id <> b.seeker_id THEN
    RAISE EXCEPTION 'Review seeker does not match booking seeker';
  END IF;

  IF NEW.provider_id <> b.provider_id THEN
    RAISE EXCEPTION 'Review provider does not match booking provider';
  END IF;

  IF NEW.service_id <> b.service_id THEN
    RAISE EXCEPTION 'Review service does not match booking service';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_review_booking_consistency ON public.reviews;
CREATE TRIGGER trg_validate_review_booking_consistency
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.validate_review_booking_consistency();

-- 3) Recompute service aggregate rating from reviews.
CREATE OR REPLACE FUNCTION public.refresh_service_rating(_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg NUMERIC;
  _count INT;
BEGIN
  SELECT COALESCE(AVG(r.rating)::NUMERIC(4,2), 0), COALESCE(COUNT(*)::INT, 0)
  INTO _avg, _count
  FROM public.reviews r
  WHERE r.service_id = _service_id;

  UPDATE public.services s
  SET
    rating = _avg,
    review_count = _count,
    updated_at = now()
  WHERE s.id = _service_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_reviews_aggregate_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_service_rating(NEW.service_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.service_id IS DISTINCT FROM NEW.service_id THEN
      PERFORM public.refresh_service_rating(OLD.service_id);
    END IF;
    PERFORM public.refresh_service_rating(NEW.service_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_service_rating(OLD.service_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_aggregate_sync ON public.reviews;
CREATE TRIGGER trg_reviews_aggregate_sync
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_reviews_aggregate_sync();

-- 4) Backfill existing service rating stats once.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.services LOOP
    PERFORM public.refresh_service_rating(rec.id);
  END LOOP;
END;
$$;
