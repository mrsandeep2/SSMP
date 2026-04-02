-- Service-level video call rooms
CREATE TABLE public.service_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX service_calls_service_id_key ON public.service_calls(service_id);
CREATE INDEX service_calls_status_idx ON public.service_calls(status);

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage service calls"
  ON public.service_calls
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Seekers can view service calls for their bookings"
  ON public.service_calls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.service_id = service_calls.service_id
        AND b.seeker_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_service_calls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_calls_updated_at ON public.service_calls;
CREATE TRIGGER trg_service_calls_updated_at
BEFORE UPDATE ON public.service_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_service_calls_updated_at();
