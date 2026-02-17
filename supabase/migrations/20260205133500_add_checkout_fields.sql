DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'orders'
  ) THEN
    CREATE TABLE public.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      discord_id TEXT NOT NULL,
      minecraft_nickname TEXT NOT NULL,
      minecraft_username TEXT NOT NULL DEFAULT '',
      discord_username TEXT NOT NULL DEFAULT '',
      total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      promo_code TEXT,
      discount_amount NUMERIC(10,2) DEFAULT 0,
      discord_notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS minecraft_username TEXT NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discord_username TEXT NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discord_notified_at TIMESTAMPTZ;

UPDATE public.orders
SET minecraft_username = COALESCE(NULLIF(minecraft_username, ''), minecraft_nickname)
WHERE minecraft_username IS NULL OR minecraft_username = '';

UPDATE public.orders
SET discord_username = COALESCE(NULLIF(discord_username, ''), discord_id)
WHERE discord_username IS NULL OR discord_username = '';

UPDATE public.orders
SET total = COALESCE(total_amount, total)
WHERE total IS NULL OR total = 0;

UPDATE public.orders
SET status = 'pending'
WHERE status IS NULL OR status = '';
