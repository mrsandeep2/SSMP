-- Create video_calls table to track video calling sessions
CREATE TABLE public.video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'active', 'ended', 'declined', 'missed')),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  call_duration_seconds INT DEFAULT 0,
  initiator_role TEXT NOT NULL CHECK (initiator_role IN ('seeker', 'admin')),
  receiver_role TEXT NOT NULL CHECK (receiver_role IN ('seeker', 'admin')),
  decline_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indices for faster queries
CREATE INDEX idx_video_calls_service_id ON public.video_calls(service_id);
CREATE INDEX idx_video_calls_booking_id ON public.video_calls(booking_id);
CREATE INDEX idx_video_calls_initiator_id ON public.video_calls(initiator_id);
CREATE INDEX idx_video_calls_receiver_id ON public.video_calls(receiver_id);
CREATE INDEX idx_video_calls_status ON public.video_calls(status);
CREATE INDEX idx_video_calls_initiated_at ON public.video_calls(initiated_at);

-- Enable RLS
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

-- Enable realtime for video_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_video_calls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_calls_updated_at ON public.video_calls;

CREATE TRIGGER trg_video_calls_updated_at
BEFORE UPDATE ON public.video_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_video_calls_updated_at();
