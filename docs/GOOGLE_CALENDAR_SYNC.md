# Google Calendar Subscription

The calendar feed is a one-way, read-only subscription from Vena Pindah to Google Calendar. It includes projects, internal calendar events, project deadlines, assigned team, event notes, and locations. Google Calendar controls how often it refreshes the feed, so changes may not appear immediately. Changes made in Google Calendar do not update Vena Pindah.

## Deploy

Apply the migration and deploy both Edge Functions. JWT verification is disabled at the gateway for both functions so browser/Google `OPTIONS` preflight requests reach the handlers. The management function validates the Supabase session and Admin role itself; the feed function validates its private token.

```powershell
supabase db push --project-ref <your-project-ref>
supabase functions deploy google-calendar-sync --no-verify-jwt --use-api --project-ref <your-project-ref>
supabase functions deploy google-calendar-feed --no-verify-jwt --use-api --project-ref <your-project-ref>
```

`--use-api` bundles functions without Docker. Both functions use Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. Do not expose the service role key in the frontend.

## Subscribe

1. Sign in as an Admin and open the calendar.
2. Select the link icon on mobile or **Google Calendar** on desktop.
3. Create and copy the feed URL.
4. In Google Calendar, open **Other calendars > From URL**, paste the URL, and add the calendar.

The URL is a secret that grants read access to calendar details. Do not post it publicly. Replacing the URL invalidates the previous feed URL; update the subscription in Google Calendar. Revoking the feed stops future refreshes, but the Google Calendar subscription may need to be removed manually.