-- Support call requests for seeker -> admin video calls
CREATE TABLE public.call_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended', 'cancelled', 'timeout')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_requests_seeker_id ON public.call_requests(seeker_id);
CREATE INDEX idx_call_requests_status ON public.call_requests(status);
CREATE INDEX idx_call_requests_created_at ON public.call_requests(created_at);

ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seekers can create own call requests"
  ON public.call_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seeker_id);

CREATE POLICY "Seekers can view own call requests"
  ON public.call_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seeker_id);

CREATE POLICY "Admins can view all call requests"
  ON public.call_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Seekers can update own call requests"
  ON public.call_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seeker_id);

CREATE POLICY "Admins can update call requests"
  ON public.call_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_call_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_call_requests_updated_at ON public.call_requests;
CREATE TRIGGER trg_call_requests_updated_at
BEFORE UPDATE ON public.call_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_call_requests_updated_at();
