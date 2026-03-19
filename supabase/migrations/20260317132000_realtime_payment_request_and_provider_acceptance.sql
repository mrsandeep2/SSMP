-- Extend payment flow:
-- seeker creates payment request, provider accepts/rejects,
-- and commission is recorded when payment is accepted.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'requested', 'paid', 'rejected', 'refunded'));

CREATE OR REPLACE FUNCTION public.enforce_booking_payment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  old_payment TEXT := COALESCE(OLD.payment_status, 'unpaid');
  new_payment TEXT := COALESCE(NEW.payment_status, old_payment);
  commission NUMERIC := COALESCE(NEW.commission_rate, 15.00);
  platform_cut NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND new_payment <> 'paid' THEN
    RAISE EXCEPTION 'Payment required before completing booking.';
  END IF;

  IF new_payment <> old_payment THEN
    -- Only seeker can request payment (or admin/system).
    IF new_payment = 'requested' THEN
      IF old_payment NOT IN ('unpaid', 'rejected') THEN
        RAISE EXCEPTION 'Invalid payment transition: % -> %.', old_payment, new_payment;
      END IF;
      IF actor_id IS NOT NULL
         AND actor_id <> OLD.seeker_id
         AND NOT public.has_role(actor_id, 'admin') THEN
        RAISE EXCEPTION 'Only seeker can request payment.';
      END IF;
    -- Provider confirms or rejects payment request.
    ELSIF new_payment IN ('paid', 'rejected') THEN
      IF old_payment <> 'requested' THEN
        RAISE EXCEPTION 'Invalid payment transition: % -> %.', old_payment, new_payment;
      END IF;
      IF actor_id IS NOT NULL
         AND actor_id <> OLD.provider_id
         AND NOT public.has_role(actor_id, 'admin') THEN
        RAISE EXCEPTION 'Only provider can accept/reject payment.';
      END IF;

      IF new_payment = 'paid' THEN
        NEW.paid_at := COALESCE(NEW.paid_at, now());
        NEW.commission_rate := commission;
        platform_cut := ROUND((COALESCE(NEW.amount, 0)::numeric * commission) / 100.0, 2);
        NEW.platform_earnings := platform_cut;
        NEW.provider_earnings := ROUND(COALESCE(NEW.amount, 0)::numeric - platform_cut, 2);
      END IF;
    ELSIF new_payment = 'refunded' THEN
      IF actor_id IS NOT NULL AND NOT public.has_role(actor_id, 'admin') THEN
        RAISE EXCEPTION 'Only admin can mark refunded.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported payment status: %.', new_payment;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_payment_rules ON public.bookings;

CREATE TRIGGER trg_enforce_booking_payment_rules
BEFORE UPDATE OF status, payment_status, payment_method, amount, commission_rate
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_payment_rules();
