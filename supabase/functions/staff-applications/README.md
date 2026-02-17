# staff-applications (Edge Function)

Authenticated endpoints for creating and editing staff applications.

## Secrets / env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (fallback if service role missing; **not recommended**)
- `DISCORD_WEBHOOK_URL` (optional; Discord notifications)
- `STAFF_APP_ADMIN_URL_BASE` (optional; used in Discord “Open Application” link)
- `STAFF_APP_RATE_LIMIT_WINDOW_SECONDS` (optional; default `3600`)
- `STAFF_APP_RATE_LIMIT_MAX` (optional; default `3`)

### Local dev

Create `supabase/functions/.env` from `supabase/functions/.env.example`, then:

```sh
supabase functions serve --env-file supabase/functions/.env
```

### Production

Set secrets in Supabase (Dashboard → Edge Functions → Secrets), or via CLI:

```sh
supabase secrets set DISCORD_WEBHOOK_URL="..."
```

## Routes

- `POST /` create new application
- `PUT /:id` edit/resubmit an existing application
