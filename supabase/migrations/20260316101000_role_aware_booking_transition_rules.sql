-- Enforce role-aware booking status transitions.
-- Seeker: may cancel from pending/accepted, or raise disputed from started.
-- Provider: handles lifecycle progression and allowed cancellations.
-- Admin: unrestricted transition override.

CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role public.app_role;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service-role/server jobs may not have auth context; allow those updates.
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ur.role
  INTO actor_role
  FROM public.user_roles ur
  WHERE ur.user_id = actor_id
  ORDER BY ur.created_at ASC
  LIMIT 1;

  IF actor_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF actor_id <> OLD.seeker_id AND actor_id <> OLD.provider_id THEN
    RAISE EXCEPTION 'Only booking participants can update status.';
  END IF;

  -- Seeker-controlled transitions.
  IF actor_id = OLD.seeker_id THEN
    IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'started' AND NEW.status = 'disputed' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Seeker cannot change booking status from % to %.', OLD.status, NEW.status;
  END IF;

  -- Provider-controlled transitions.
  IF actor_id = OLD.provider_id THEN
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

    IF OLD.status = 'started' AND NEW.status IN ('completed', 'cancelled') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Provider cannot change booking status from % to %.', OLD.status, NEW.status;
  END IF;

  RAISE EXCEPTION 'Unauthorized status update for booking.';
END;
$$;
