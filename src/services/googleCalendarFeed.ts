import supabase from '../lib/supabaseClient';

type FeedResponse = {
  active?: boolean;
  url?: string;
  error?: string;
};

async function invokeFeedAction(action: 'status' | 'create' | 'revoke'): Promise<FeedResponse> {
  const { data, error } = await supabase.functions.invoke<FeedResponse>('google-calendar-sync', {
    body: { action },
  });
  if (error?.name === 'FunctionsFetchError') {
    throw new Error('Fungsi Google Calendar belum terjangkau. Deploy google-calendar-sync dengan --no-verify-jwt agar preflight CORS dapat diproses.');
  }
  if (error) throw new Error(error.message || 'Gagal mengelola sinkronisasi Google Calendar.');
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export const getGoogleCalendarFeedStatus = () => invokeFeedAction('status');
export const createGoogleCalendarFeed = () => invokeFeedAction('create');
export const revokeGoogleCalendarFeed = () => invokeFeedAction('revoke');