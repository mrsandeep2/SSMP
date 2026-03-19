-- Add booking payment tracking and enforce payment before completion.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill already completed bookings as paid to keep historical rows consistent.
UPDATE public.bookings
SET
  payment_status = 'paid',
  paid_at = COALESCE(paid_at, updated_at, now())
WHERE status = 'completed'
  AND COALESCE(payment_status, 'unpaid') <> 'paid';

CREATE OR REPLACE FUNCTION public.enforce_booking_payment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
BEGIN
  -- Guard 1: completion requires paid status.
  IF NEW.status = 'completed' AND COALESCE(NEW.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment required before completing booking.';
  END IF;

  -- Guard 2: only seeker (or admin/system) can mark as paid.
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'paid' THEN
      IF actor_id IS NOT NULL
         AND actor_id <> OLD.seeker_id
         AND NOT public.has_role(actor_id, 'admin') THEN
        RAISE EXCEPTION 'Only seeker can confirm payment.';
      END IF;
      IF COALESCE(OLD.payment_status, 'unpaid') <> 'paid' THEN
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_payment_rules ON public.bookings;

CREATE TRIGGER trg_enforce_booking_payment_rules
BEFORE UPDATE OF status, payment_status, payment_method
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_payment_rules();
