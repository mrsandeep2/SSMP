-- Add service context + unique ticket code for support tickets.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_code TEXT,
  ADD COLUMN IF NOT EXISTS created_by_role public.app_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_tickets_ticket_code
  ON public.support_tickets(ticket_code)
  WHERE ticket_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_service_id
  ON public.support_tickets(service_id)
  WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by_role
  ON public.support_tickets(created_by_role, created_at DESC)
  WHERE created_by_role IS NOT NULL;

CREATE OR REPLACE FUNCTION public.populate_support_ticket_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _booking_provider UUID;
  _booking_service UUID;
  _service_fragment TEXT;
  _ticket_time TEXT;
  _ticket_rand TEXT;
BEGIN
  IF NEW.created_by_role IS NULL THEN
    SELECT ur.role
    INTO _role
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.created_by
    ORDER BY ur.created_at ASC
    LIMIT 1;

    NEW.created_by_role := _role;
  END IF;

  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.provider_id, b.service_id
    INTO _booking_provider, _booking_service
    FROM public.bookings b
    WHERE b.id = NEW.booking_id;

    IF NEW.provider_id IS NULL THEN
      NEW.provider_id := _booking_provider;
    END IF;

    IF NEW.service_id IS NULL THEN
      NEW.service_id := _booking_service;
    END IF;
  END IF;

  IF NEW.ticket_code IS NULL OR length(trim(NEW.ticket_code)) = 0 THEN
    _service_fragment := COALESCE(REPLACE(NEW.service_id::text, '-', ''), 'general');
    _service_fragment := UPPER(SUBSTRING(_service_fragment FROM 1 FOR 6));
    _ticket_time := to_char(now(), 'YYMMDDHH24MISS');
    _ticket_rand := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 4));

    NEW.ticket_code := format('TKT-%s-%s-%s', _service_fragment, _ticket_time, _ticket_rand);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_support_ticket_identity ON public.support_tickets;

CREATE TRIGGER trg_populate_support_ticket_identity
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.populate_support_ticket_identity();
