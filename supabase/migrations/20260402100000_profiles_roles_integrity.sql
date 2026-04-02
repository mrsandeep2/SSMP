-- Backfill missing name/email from auth.users when possible
UPDATE profiles AS p
SET
  email = COALESCE(p.email, u.email),
  name = COALESCE(
    p.name,
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name'
  )
FROM auth.users AS u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.name IS NULL);

-- Ensure no NULLs remain
UPDATE profiles
SET email = 'missing+' || id::text || '@example.invalid'
WHERE email IS NULL;

UPDATE profiles
SET name = 'Unknown'
WHERE name IS NULL;

-- Block migration if duplicates exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM profiles
    GROUP BY email
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate emails exist in profiles. Resolve before applying unique constraint.';
  END IF;
END $$;

-- Enforce profile integrity
ALTER TABLE profiles
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON profiles(email);

-- Enforce user_roles -> profiles relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW user_full_details AS
SELECT
  p.id,
  p.name,
  p.email,
  COALESCE(ARRAY_AGG(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles,
  p.created_at
FROM profiles p
LEFT JOIN user_roles r
  ON p.id = r.user_id
GROUP BY p.id, p.name, p.email, p.created_at;

CREATE OR REPLACE VIEW provider_services_clean_view AS
SELECT
  p.id AS provider_id,
  p.name,
  p.email,
  ARRAY_AGG(
    JSON_BUILD_OBJECT(
      'service_id', s.id,
      'title', s.title,
      'description', s.description,
      'category', s.category
    )
    ORDER BY s.title
  ) AS services
FROM profiles p
JOIN services s
  ON p.id = s.provider_id
GROUP BY p.id, p.name, p.email
ORDER BY p.email ASC;
