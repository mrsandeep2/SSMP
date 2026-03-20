-- Prevent silent offline push failure caused by disabled switch after webhook is configured.

UPDATE public.push_notification_settings
SET enabled = true,
    updated_at = now()
WHERE id = true
  AND COALESCE(enabled, false) = false
  AND webhook_url IS NOT NULL
  AND length(trim(webhook_url)) > 0;

ALTER TABLE public.push_notification_settings
ALTER COLUMN enabled SET DEFAULT true;