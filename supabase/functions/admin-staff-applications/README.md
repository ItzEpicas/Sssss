# admin-staff-applications (Edge Function)

Admin-only endpoints for managing staff applications (status updates, internal notes, revision fetch).

## Secrets / env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (fallback if service role missing; **not recommended**)
- `DISCORD_WEBHOOK_URL` (optional; Discord notifications on edits)
- `STAFF_APP_ADMIN_URL_BASE` (optional; used in Discord “Open Application” link)

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

- `GET /` list applications (filters via querystring)
- `GET /:id` application detail (includes revisions + notes)
- `PUT /:id` admin edit (creates revision)
- `PATCH /:id/status` update status
- `POST /:id/notes` add internal note
- `GET /:id/revisions` list revisions
- `GET /:id/revisions/:revId` fetch a revision snapshot
