-- Ensure payment decision changes (paid/rejected/refunded) dispatch offline push events.

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
  _old_payment TEXT := COALESCE(OLD.payment_status, 'unpaid');
  _new_payment TEXT := COALESCE(NEW.payment_status, _old_payment);
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
    ELSIF _new_payment IS DISTINCT FROM _old_payment THEN
      IF _new_payment = 'requested' THEN
        _should_send := true;
        _event_type := 'booking_payment_requested';
      ELSIF _new_payment IN ('paid', 'rejected', 'refunded') THEN
        _should_send := true;
        _event_type := 'booking_payment_updated';
      END IF;
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
    'from_payment_status', CASE WHEN TG_OP = 'UPDATE' THEN _old_payment ELSE NULL END,
    'to_payment_status', CASE WHEN TG_OP = 'UPDATE' THEN _new_payment ELSE NULL END,
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