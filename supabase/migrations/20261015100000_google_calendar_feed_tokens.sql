CREATE TABLE IF NOT EXISTS public.google_calendar_feed_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_feed_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_feed_tokens FROM anon, authenticated;