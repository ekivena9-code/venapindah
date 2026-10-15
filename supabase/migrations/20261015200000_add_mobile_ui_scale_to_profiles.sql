-- Add mobile UI scale preference column to profiles table.
-- NULL means no remote preference exists; clients use 1.0. Reset stores 1.0 explicitly.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS mobile_ui_scale NUMERIC
        CHECK (mobile_ui_scale IS NULL OR (mobile_ui_scale >= 0.4 AND mobile_ui_scale <= 1.4));

-- No RLS changes needed — profile rows are already RLS-scoped per admin_user_id.
NOTIFY pgrst, 'reload schema';
