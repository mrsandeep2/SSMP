-- Send seeker offline push for any provider-driven booking status change.

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
  _actor_id UUID := auth.uid();
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
       AND _actor_id = NEW.provider_id THEN
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
    'from_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    'to_status', NEW.status,
    'trigger_actor_id', _actor_id,
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
