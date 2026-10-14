CREATE TABLE IF NOT EXISTS public.ui_text_overrides (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    overrides JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(overrides) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ui_text_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own UI text overrides"
    ON public.ui_text_overrides;
CREATE POLICY "Users can manage their own UI text overrides"
    ON public.ui_text_overrides
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.ui_text_overrides TO authenticated;

CREATE OR REPLACE FUNCTION public.set_ui_text_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ui_text_overrides_updated_at
    ON public.ui_text_overrides;
CREATE TRIGGER ui_text_overrides_updated_at
    BEFORE UPDATE ON public.ui_text_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_ui_text_overrides_updated_at();

NOTIFY pgrst, 'reload schema';