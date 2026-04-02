-- Fix phone OTP signup failure: auth.users.email can be NULL for phone-only users.
-- The profile trigger must not insert NULL into public.profiles.email.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );

  RETURN NEW;
END;
$$;
