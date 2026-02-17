-- Staff Applications system (applications + revisions + admin notes) with rate limiting.
-- Designed for Edge Function writes (service role) and RLS-protected reads (users + staff).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'staff_application_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.staff_application_status AS ENUM (
      'pending',
      'accepted',
      'denied',
      'need_more_info'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'staff_application_position' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.staff_application_position AS ENUM (
      'moderator',
      'helper',
      'admin',
      'support',
      'builder',
      'other'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Main table (current/latest application state)
CREATE TABLE IF NOT EXISTS public.staff_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.staff_application_status NOT NULL DEFAULT 'pending',
  position public.staff_application_position NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_edited_at TIMESTAMPTZ,
  last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  latest_revision_number INT NOT NULL DEFAULT 1,
  revision_count INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_staff_applications_user ON public.staff_applications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_applications_status ON public.staff_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_applications_position ON public.staff_applications (position, created_at DESC);

-- Append-only revision history (full snapshots)
CREATE TABLE IF NOT EXISTS public.staff_application_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.staff_applications(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  content_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_application_revisions_app_rev
  ON public.staff_application_revisions (application_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_staff_application_revisions_app_created
  ON public.staff_application_revisions (application_id, created_at DESC);

-- Admin/staff internal notes
CREATE TABLE IF NOT EXISTS public.staff_application_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.staff_applications(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_application_admin_notes_app_created
  ON public.staff_application_admin_notes (application_id, created_at DESC);

-- Keep staff_applications.updated_at fresh
DROP TRIGGER IF EXISTS update_staff_applications_updated_at ON public.staff_applications;
CREATE TRIGGER update_staff_applications_updated_at
BEFORE UPDATE ON public.staff_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rate limit: 3 actions/hour per bucket (Edge Functions call this helper).
CREATE TABLE IF NOT EXISTS public.staff_app_rate_limit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_app_rate_limit_events_bucket_created
  ON public.staff_app_rate_limit_events (bucket, created_at DESC);

ALTER TABLE public.staff_app_rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No direct client access (Edge Functions call the SECURITY DEFINER function instead).
REVOKE ALL ON TABLE public.staff_app_rate_limit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_app_rate_limit_events FROM anon;
REVOKE ALL ON TABLE public.staff_app_rate_limit_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_staff_app_rate_limit(
  p_bucket TEXT,
  p_window_seconds INT,
  p_max_count INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket TEXT := trim(COALESCE(p_bucket, ''));
  v_now TIMESTAMPTZ := now();
  v_cutoff TIMESTAMPTZ;
  v_count INT;
  v_earliest TIMESTAMPTZ;
  v_retry INT;
BEGIN
  IF v_bucket = '' THEN
    RETURN 0;
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RETURN 0;
  END IF;

  IF p_max_count IS NULL OR p_max_count <= 0 THEN
    RETURN 0;
  END IF;

  -- Serialize checks per bucket to avoid race conditions.
  PERFORM pg_advisory_xact_lock(hashtext(v_bucket));

  v_cutoff := v_now - (interval '1 second' * p_window_seconds);

  DELETE FROM public.staff_app_rate_limit_events
  WHERE bucket = v_bucket
    AND created_at < v_cutoff;

  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_earliest
  FROM public.staff_app_rate_limit_events
  WHERE bucket = v_bucket;

  IF COALESCE(v_count, 0) >= p_max_count THEN
    IF v_earliest IS NULL THEN
      RETURN 1;
    END IF;
    v_retry := p_window_seconds - floor(extract(epoch from (v_now - v_earliest)));
    RETURN greatest(1, v_retry);
  END IF;

  INSERT INTO public.staff_app_rate_limit_events (bucket, created_at)
  VALUES (v_bucket, v_now);

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_staff_app_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_staff_app_rate_limit(TEXT, INT, INT) TO anon, authenticated, service_role;

-- Audit webhook deliveries for staff applications (optional; keeps a single webhook log table).
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS staff_application_id UUID REFERENCES public.staff_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_staff_application
  ON public.webhook_deliveries (staff_application_id);

-- RLS
ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_application_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_application_admin_notes ENABLE ROW LEVEL SECURITY;

-- staff_applications: read-only via RLS (writes are via Edge Functions / service role)
DROP POLICY IF EXISTS "Users can view own staff applications" ON public.staff_applications;
CREATE POLICY "Users can view own staff applications"
  ON public.staff_applications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all staff applications" ON public.staff_applications;
CREATE POLICY "Staff can view all staff applications"
  ON public.staff_applications
  FOR SELECT
  USING (public.is_staff(auth.uid()));

-- staff_application_revisions: read-only via RLS (append-only; writes via Edge Functions / service role)
DROP POLICY IF EXISTS "Users can view revisions for own applications" ON public.staff_application_revisions;
CREATE POLICY "Users can view revisions for own applications"
  ON public.staff_application_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_applications a
      WHERE a.id = staff_application_revisions.application_id
        AND (a.user_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  );

-- staff_application_admin_notes: staff-only (internal)
DROP POLICY IF EXISTS "Staff can view staff application notes" ON public.staff_application_admin_notes;
CREATE POLICY "Staff can view staff application notes"
  ON public.staff_application_admin_notes
  FOR SELECT
  USING (public.is_staff(auth.uid()));

