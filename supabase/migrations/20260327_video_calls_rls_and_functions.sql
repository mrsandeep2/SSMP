-- RLS Policies for video_calls table

-- SELECT: Seeker can see calls where they are involved, Admin can see all
CREATE POLICY "Users can see their own video calls"
ON public.video_calls
FOR SELECT
USING (
  auth.uid() = initiator_id 
  OR auth.uid() = receiver_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- INSERT: Only allow initiating calls with proper validation
CREATE POLICY "Users can create video calls (with validation)"
ON public.video_calls
FOR INSERT
WITH CHECK (
  auth.uid() = initiator_id
  AND (
    -- Admin can always initiate calls
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      -- Seeker can initiate only if booking is completed
      public.has_role(auth.uid(), 'seeker'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = video_calls.booking_id
        AND seeker_id = auth.uid()
        AND status = 'completed'
      )
    )
  )
);

-- UPDATE: Allow status updates and accept/decline
CREATE POLICY "Users can update video calls they are involved in"
ON public.video_calls
FOR UPDATE
USING (
  auth.uid() = initiator_id 
  OR auth.uid() = receiver_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = initiator_id 
  OR auth.uid() = receiver_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Create helper function to check if user can initiate video call
CREATE OR REPLACE FUNCTION public.can_initiate_video_call(_user_id UUID, _booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin can always call
    public.has_role(_user_id, 'admin'::app_role)
    OR (
      -- Seeker can call only after completion
      public.has_role(_user_id, 'seeker'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = _booking_id
        AND seeker_id = _user_id
        AND status = 'completed'
      )
    )
$$;

-- Function to automatically end old calls (cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_calls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.video_calls
  SET status = 'missed', ended_at = now()
  WHERE status IN ('pending', 'ringing')
  AND initiated_at < now() - INTERVAL '2 minutes'
  AND ended_at IS NULL;
END;
$$;
