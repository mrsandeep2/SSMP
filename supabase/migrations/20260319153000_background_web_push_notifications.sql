-- Offline/background web push notifications for booking lifecycle.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
ON public.push_subscriptions (user_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can view own push subscriptions'
  ) THEN
    CREATE POLICY "Users can view own push subscriptions"
      ON public.push_subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_push_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_push_subscriptions_updated_at ON public.push_subscriptions;

CREATE TRIGGER trg_touch_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.touch_push_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Invalid push subscription payload.';
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    is_active,
    last_seen_at
  ) VALUES (
    _uid,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    true,
    now()
  )
  ON CONFLICT (endpoint)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    is_active = true,
    last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(
  p_endpoint TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.push_subscriptions
  SET is_active = false,
      last_seen_at = now()
  WHERE endpoint = p_endpoint
    AND user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.unregister_push_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_notification_settings'
      AND policyname = 'Admins manage push notification settings'
  ) THEN
    CREATE POLICY "Admins manage push notification settings"
      ON public.push_notification_settings
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

INSERT INTO public.push_notification_settings (id, enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_push_notification_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_push_notification_settings_updated_at ON public.push_notification_settings;

CREATE TRIGGER trg_touch_push_notification_settings_updated_at
BEFORE UPDATE ON public.push_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_push_notification_settings_updated_at();

CREATE OR REPLACE FUNCTION public.dispatch_booking_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings RECORD;
  _should_send BOOLEAN := false;
  _event_type TEXT := NULL;
  _payload JSONB;
BEGIN
  SELECT enabled, webhook_url, webhook_secret
  INTO _settings
  FROM public.push_notification_settings
  WHERE id = true;

  IF COALESCE(_settings.enabled, false) = false
     OR _settings.webhook_url IS NULL
     OR length(trim(_settings.webhook_url)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _should_send := true;
    _event_type := 'booking_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('accepted', 'on_the_way') THEN
      _should_send := true;
      _event_type := 'booking_status_updated';
    ELSIF COALESCE(NEW.payment_status, 'unpaid') IS DISTINCT FROM COALESCE(OLD.payment_status, 'unpaid')
       AND COALESCE(NEW.payment_status, 'unpaid') = 'requested' THEN
      _should_send := true;
      _event_type := 'booking_payment_requested';
    END IF;
  END IF;

  IF NOT _should_send THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'event_type', _event_type,
    'booking', to_jsonb(NEW),
    'old_booking', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    'triggered_at', now()
  );

  PERFORM net.http_post(
    url := _settings.webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', COALESCE(_settings.webhook_secret, '')
    ),
    body := _payload
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_push_notify_booking_insert'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_push_notify_booking_insert
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_booking_push_notification();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_push_notify_booking_update'
      AND tgrelid = 'public.bookings'::regclass
  ) THEN
    CREATE TRIGGER trg_push_notify_booking_update
    AFTER UPDATE OF status, payment_status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_booking_push_notification();
  END IF;
END;
$$;
