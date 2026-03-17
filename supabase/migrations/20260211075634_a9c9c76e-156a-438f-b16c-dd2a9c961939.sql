
-- Add approval_status to services for admin approval workflow
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
-- New services from providers will be 'pending', admin approves/rejects

-- Add availability toggle for providers on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- Allow admins to view all services (including pending)
CREATE POLICY "Admins can view all services"
ON public.services
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any service (approve/reject)
CREATE POLICY "Admins can update any service"
ON public.services
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Providers can view their own services regardless of status
CREATE POLICY "Providers can view own services"
ON public.services
FOR SELECT
TO authenticated
USING (auth.uid() = provider_id);
