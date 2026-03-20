-- Persistent notification inbox so dashboard notifications survive refresh/logout.

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('booking_created', 'booking_status_updated', 'booking_payment_requested', 'booking_payment_updated')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
ON public.user_notifications (user_id, is_read, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can read own notifications'
  ) THEN
    CREATE POLICY "Users can read own notifications"
      ON public.user_notifications
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.user_notifications
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications"
      ON public.user_notifications
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_user_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _target_user UUID;
  _category TEXT;
  _title TEXT;
  _body TEXT;
  _old_status TEXT := COALESCE(OLD.status, 'pending');
  _new_status TEXT := COALESCE(NEW.status, _old_status);
  _old_payment TEXT := COALESCE(OLD.payment_status, 'unpaid');
  _new_payment TEXT := COALESCE(NEW.payment_status, _old_payment);
  _normalized_old_status TEXT;
  _normalized_new_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _target_user := NEW.provider_id;
    _category := 'booking_created';
    _title := 'New booking request';
    _body := 'A seeker has requested your service.';
  ELSIF TG_OP = 'UPDATE' THEN
    _normalized_old_status := CASE
      WHEN _old_status = 'confirmed' THEN 'accepted'
      WHEN _old_status = 'in_progress' THEN 'started'
      ELSE _old_status
    END;
    _normalized_new_status := CASE
      WHEN _new_status = 'confirmed' THEN 'accepted'
      WHEN _new_status = 'in_progress' THEN 'started'
      ELSE _new_status
    END;

    IF _new_status IS DISTINCT FROM _old_status
       AND _normalized_new_status IS DISTINCT FROM _normalized_old_status
       AND _actor_id = NEW.provider_id THEN
      _target_user := NEW.seeker_id;
      _category := 'booking_status_updated';
      IF _normalized_new_status = 'accepted' THEN
        _title := 'Your service request is accepted by provider';
        _body := 'Provider accepted your service request. Open dashboard for details.';
      ELSE
        _title := format('Booking status updated: %s', replace(_normalized_new_status, '_', ' '));
        _body := format(
          'Provider changed booking status from %s to %s. Open dashboard for details.',
          replace(_normalized_old_status, '_', ' '),
          replace(_normalized_new_status, '_', ' ')
        );
      END IF;
    ELSIF _new_payment IS DISTINCT FROM _old_payment THEN
      _target_user := NEW.seeker_id;

      IF _new_payment = 'requested' THEN
        _category := 'booking_payment_requested';
        _title := 'Payment requested';
        _body := 'Payment action is required for your booking.';
      ELSIF _new_payment IN ('paid', 'rejected', 'refunded') THEN
        _category := 'booking_payment_updated';
        IF _new_payment = 'paid' THEN
          _title := 'Payment received successfully';
          _body := 'Your provider confirmed payment. Booking can now be completed.';
        ELSE
          _title := 'Payment status updated';
          _body := format('Payment changed from %s to %s.', _old_payment, _new_payment);
        END IF;
      END IF;
    END IF;
  END IF;

  IF _target_user IS NULL OR _category IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (user_id, booking_id, category, title, body, metadata)
  VALUES (
    _target_user,
    NEW.id,
    _category,
    _title,
    _body,
    jsonb_build_object(
      'booking_id', NEW.id,
      'from_status', CASE WHEN TG_OP = 'UPDATE' THEN _old_status ELSE NULL END,
      'to_status', NEW.status,
      'from_payment_status', CASE WHEN TG_OP = 'UPDATE' THEN _old_payment ELSE NULL END,
      'to_payment_status', CASE WHEN TG_OP = 'UPDATE' THEN _new_payment ELSE NULL END,
      'trigger_actor_id', _actor_id,
      'created_at', now()
    )
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_create_booking_user_notification_insert'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_create_booking_user_notification_insert
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.create_booking_user_notification();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_create_booking_user_notification_update'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_create_booking_user_notification_update
    AFTER UPDATE OF status, payment_status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.create_booking_user_notification();
  END IF;
END;
$$;