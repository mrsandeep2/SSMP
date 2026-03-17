-- Standardize booking statuses to canonical lifecycle values.
-- Old values: confirmed, in_progress
-- New values: accepted, on_the_way, arrived, started

UPDATE public.bookings
SET status = 'accepted'
WHERE status = 'confirmed';

UPDATE public.bookings
SET status = 'started'
WHERE status = 'in_progress';

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_status_check
CHECK (
  status IN (
    'pending',
    'accepted',
    'on_the_way',
    'arrived',
    'started',
    'completed',
    'cancelled',
    'disputed'
  )
);
