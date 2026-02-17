# Georgian Craft Hub

Vite + React + TypeScript + shadcn-ui + Tailwind CSS, backed by Supabase.

## Local development

```sh
npm i
npm run dev
```

Frontend env vars (`.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Minecraft Staff Application System

This repo includes a Staff Application system:

- User Profile → **Staff App** tab (`/profile`)
- Admin Panel → **Staff Apps** (`/admin/staff-applications`)
- Append-only revision history + diff viewer
- Discord webhook notifications on **new** + **edited** submissions

### Database

Migration:

- `supabase/migrations/20260217120000_add_staff_applications.sql`

Tables:

- `public.staff_applications` (current/latest state)
- `public.staff_application_revisions` (append-only snapshots)
- `public.staff_application_admin_notes` (internal notes)

Rate limit helper:

- `public.enforce_staff_app_rate_limit(bucket, windowSeconds, maxCount)` (defaults controlled via function env vars)

### Edge Functions (API)

User:

- `POST /functions/v1/staff-applications`
- `GET /functions/v1/staff-applications/mine`
- `GET /functions/v1/staff-applications/:id`
- `PUT /functions/v1/staff-applications/:id`

Admin (admin-only):

- `GET /functions/v1/admin-staff-applications`
- `GET /functions/v1/admin-staff-applications/:id`
- `PUT /functions/v1/admin-staff-applications/:id` (admin edit → creates revision)
- `PATCH /functions/v1/admin-staff-applications/:id/status`
- `POST /functions/v1/admin-staff-applications/:id/notes`
- `GET /functions/v1/admin-staff-applications/:id/revisions`
- `GET /functions/v1/admin-staff-applications/:id/revisions/:revId`

### Edge Function secrets / env vars

Set these in Supabase (Edge Function secrets), not in the frontend `.env`:

- `DISCORD_WEBHOOK_URL` (optional but recommended)
- `STAFF_APP_ADMIN_URL_BASE` (optional, used in Discord “Open Application” link)
- `STAFF_APP_RATE_LIMIT_WINDOW_SECONDS` (optional, default `3600`)
- `STAFF_APP_RATE_LIMIT_MAX` (optional, default `3`)

### Sample payloads

Create (`POST /functions/v1/staff-applications`):

```json
{
  "position": "helper",
  "answers": {
    "age": 18,
    "discordTag": "username#1234",
    "timezone": "UTC+4",
    "serverPlaytime": "Since 2024, ~10h/week",
    "availability": "Weekdays: 2h, Weekends: 6h",
    "experience": "I moderated 2 servers for 1+ year...",
    "motivation": "I want to help the community stay friendly.",
    "minecraftUsername": "RageMC",
    "additionalInfo": "I can also help with events.",
    "rulesAccepted": true
  }
}
```

Edit (`PUT /functions/v1/staff-applications/:id`):

```json
{
  "position": "helper",
  "answers": {
    "age": 18,
    "discordTag": "username#1234",
    "timezone": "UTC+4",
    "serverPlaytime": "Since 2024, ~10h/week",
    "availability": "Updated availability...",
    "experience": "Updated experience...",
    "motivation": "Updated motivation...",
    "rulesAccepted": true
  },
  "changeReason": "Updated availability and experience"
}
```
