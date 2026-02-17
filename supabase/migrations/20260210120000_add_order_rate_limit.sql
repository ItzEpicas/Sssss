-- Adds server-side rate limiting helper for order creation.
-- This creates an internal table + SECURITY DEFINER function that enforces a cooldown window per bucket.

CREATE TABLE IF NOT EXISTS public.order_rate_limits (
  bucket TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client access (Edge Functions call the SECURITY DEFINER function instead).
REVOKE ALL ON TABLE public.order_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.order_rate_limits FROM anon;
REVOKE ALL ON TABLE public.order_rate_limits FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_cooldown(p_bucket TEXT, p_window_seconds INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket TEXT := trim(COALESCE(p_bucket, ''));
  v_now TIMESTAMPTZ := now();
  v_updated TIMESTAMPTZ;
  v_retry INT;
BEGIN
  IF v_bucket = '' THEN
    RETURN 0;
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RETURN 0;
  END IF;

  -- Insert a new bucket, or update it only if the cooldown elapsed.
  WITH upsert AS (
    INSERT INTO public.order_rate_limits (bucket, updated_at)
    VALUES (v_bucket, v_now)
    ON CONFLICT (bucket) DO UPDATE
      SET updated_at = EXCLUDED.updated_at
      WHERE public.order_rate_limits.updated_at <= v_now - (interval '1 second' * p_window_seconds)
    RETURNING public.order_rate_limits.updated_at
  )
  SELECT updated_at INTO v_updated FROM upsert;

  -- Allowed (new bucket or cooldown elapsed).
  IF FOUND THEN
    RETURN 0;
  END IF;

  -- Still in cooldown; compute remaining seconds.
  SELECT updated_at INTO v_updated
  FROM public.order_rate_limits
  WHERE bucket = v_bucket;

  IF v_updated IS NULL THEN
    RETURN 0;
  END IF;

  v_retry := p_window_seconds - floor(extract(epoch from (v_now - v_updated)));
  RETURN greatest(1, v_retry);
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_order_cooldown(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_order_cooldown(TEXT, INT) TO anon, authenticated, service_role;

