-- Extend push_subscriptions for direct frontend insert/update with strict RLS.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can insert own push subscriptions'
  ) THEN
    CREATE POLICY "Users can insert own push subscriptions"
      ON public.push_subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can update own push subscriptions'
  ) THEN
    CREATE POLICY "Users can update own push subscriptions"
      ON public.push_subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
      AND policyname = 'Users can delete own push subscriptions'
  ) THEN
    CREATE POLICY "Users can delete own push subscriptions"
      ON public.push_subscriptions
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END;
$$;
