-- Add support ticket chat + notification automation.

DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO _constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'user_notifications'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%category%';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_notifications DROP CONSTRAINT %I', _constraint_name);
  END IF;
END;
$$;

ALTER TABLE public.user_notifications
ADD CONSTRAINT user_notifications_category_check
CHECK (
  category IN (
    'booking_created',
    'booking_status_updated',
    'booking_payment_requested',
    'booking_payment_updated',
    'support_ticket_created',
    'support_ticket_reply',
    'support_ticket_assigned',
    'support_ticket_status'
  )
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role public.app_role NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
  ON public.support_ticket_messages(ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_sender_created
  ON public.support_ticket_messages(sender_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.fill_support_ticket_message_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_role IS NULL THEN
    SELECT ur.role
    INTO NEW.sender_role
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.sender_id
    ORDER BY ur.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_support_ticket_message_sender_role ON public.support_ticket_messages;

CREATE TRIGGER trg_fill_support_ticket_message_sender_role
BEFORE INSERT ON public.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.fill_support_ticket_message_sender_role();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Participants can read non-internal support messages'
  ) THEN
    CREATE POLICY "Participants can read non-internal support messages"
      ON public.support_ticket_messages
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR (
          is_internal = false
          AND EXISTS (
            SELECT 1
            FROM public.support_tickets st
            WHERE st.id = support_ticket_messages.ticket_id
              AND (
                st.created_by = auth.uid()
                OR (st.assigned_role = 'provider' AND st.assigned_to = auth.uid())
              )
          )
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Participants can insert support messages'
  ) THEN
    CREATE POLICY "Participants can insert support messages"
      ON public.support_ticket_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        sender_id = auth.uid()
        AND (
          public.has_role(auth.uid(), 'admin')
          OR (
            is_internal = false
            AND EXISTS (
              SELECT 1
              FROM public.support_tickets st
              WHERE st.id = support_ticket_messages.ticket_id
                AND (
                  st.created_by = auth.uid()
                  OR (st.assigned_role = 'provider' AND st.assigned_to = auth.uid())
                )
            )
          )
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_ticket_messages'
      AND policyname = 'Admins can manage all support messages'
  ) THEN
    CREATE POLICY "Admins can manage all support messages"
      ON public.support_ticket_messages
      FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_support_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type <> 'complaint' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    booking_id,
    category,
    title,
    body,
    metadata
  )
  SELECT
    ur.user_id,
    NEW.booking_id,
    'support_ticket_created',
    'New complaint received',
    format('Ticket "%s" needs review.', NEW.subject),
    jsonb_build_object(
      'ticket_id', NEW.id,
      'type', NEW.type,
      'booking_id', NEW.booking_id,
      'created_by', NEW.created_by
    )
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_new_support_complaint ON public.support_tickets;

CREATE TRIGGER trg_notify_admins_on_new_support_complaint
AFTER INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_new_support_complaint();

CREATE OR REPLACE FUNCTION public.notify_ticket_creator_on_admin_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket public.support_tickets%ROWTYPE;
BEGIN
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_role(NEW.sender_id, 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO _ticket
  FROM public.support_tickets st
  WHERE st.id = NEW.ticket_id;

  IF _ticket.created_by IS NULL OR _ticket.created_by = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    booking_id,
    category,
    title,
    body,
    metadata
  )
  VALUES (
    _ticket.created_by,
    _ticket.booking_id,
    'support_ticket_reply',
    'Support replied to your complaint',
    'Open Support Center to continue the conversation.',
    jsonb_build_object(
      'ticket_id', _ticket.id,
      'message_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_creator_on_admin_reply ON public.support_ticket_messages;

CREATE TRIGGER trg_notify_ticket_creator_on_admin_reply
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_creator_on_admin_reply();

CREATE OR REPLACE FUNCTION public.notify_provider_on_support_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_role = 'provider'
     AND NEW.assigned_to IS NOT NULL
     AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR OLD.assigned_role IS DISTINCT FROM NEW.assigned_role) THEN
    INSERT INTO public.user_notifications (
      user_id,
      booking_id,
      category,
      title,
      body,
      metadata
    )
    VALUES (
      NEW.assigned_to,
      NEW.booking_id,
      'support_ticket_assigned',
      'You are involved in a complaint case',
      'Please review the assigned support ticket in your dashboard.',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'assigned_to', NEW.assigned_to,
        'assigned_role', NEW.assigned_role
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_provider_on_support_assignment ON public.support_tickets;

CREATE TRIGGER trg_notify_provider_on_support_assignment
AFTER UPDATE OF assigned_to, assigned_role ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_provider_on_support_assignment();

CREATE OR REPLACE FUNCTION public.notify_admin_on_user_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_internal THEN
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.sender_id, 'admin') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    category,
    title,
    body,
    metadata
  )
  SELECT
    ur.user_id,
    'support_ticket_reply',
    'User replied',
    'User responded to ticket',
    jsonb_build_object('ticket_id', NEW.ticket_id, 'message_id', NEW.id)
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_notifications un
      WHERE un.user_id = ur.user_id
        AND un.category = 'support_ticket_reply'
        AND un.created_at > now() - interval '30 seconds'
        AND (un.metadata ->> 'ticket_id')::uuid = NEW.ticket_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_user_reply ON public.support_ticket_messages;

CREATE TRIGGER trg_notify_admin_on_user_reply
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_on_user_reply();

CREATE OR REPLACE FUNCTION public.notify_support_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_notifications (
      user_id,
      booking_id,
      category,
      title,
      body,
      metadata
    )
    VALUES (
      NEW.created_by,
      NEW.booking_id,
      'support_ticket_status',
      'Ticket updated',
      'Status changed to ' || NEW.status,
      jsonb_build_object('ticket_id', NEW.id, 'from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_ticket_status_change ON public.support_tickets;

CREATE TRIGGER trg_notify_support_ticket_status_change
AFTER UPDATE OF status ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_ticket_status_change();
