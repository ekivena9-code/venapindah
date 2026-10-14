import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const TABLE = 'ui_text_overrides';

function parseOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, text]) => typeof text === 'string'),
  );
}

export async function loadUiTextOverrides(): Promise<Record<string, string> | null | undefined> {
  if (!isSupabaseConfigured) return undefined;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return undefined;

  const { data, error } = await supabase
    .from(TABLE)
    .select('overrides')
    .eq('user_id', sessionData.session.user.id)
    .maybeSingle();
  if (error) throw error;

  return data ? parseOverrides(data.overrides) : null;
}

export async function saveRemoteUiTextOverrides(
  overrides: Record<string, string>,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Sesi Supabase tidak ditemukan. Silakan masuk kembali.');

  const userId = sessionData.session.user.id;
  if (Object.keys(overrides).length === 0) {
    const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, overrides }, { onConflict: 'user_id' });
  if (error) throw error;
}