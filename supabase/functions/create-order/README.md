# `create-order` (Supabase Edge Function)

Creates a new order and (optionally) sends a Discord webhook notification, then returns a `redirectUrl` for the checkout flow.

## Secrets

Set these in Supabase (Project Settings → Edge Functions → Secrets) or via the Supabase CLI:

- `DISCORD_ORDERS_WEBHOOK_URL` (required): Discord webhook URL (channel where you want to receive new order messages).
- `DISCORD_REDIRECT_URL` (optional): Where the customer is redirected after checkout (defaults to `https://discord.gg/XfAK8GHDRY`).

## CLI example

```sh
supabase secrets set \
  DISCORD_ORDERS_WEBHOOK_URL="https://discord.com/api/webhooks/XXX/YYY" \
  DISCORD_REDIRECT_URL="https://discord.gg/XfAK8GHDRY"
```

Note: the webhook URL is a secret — don’t put it in frontend `VITE_...` env vars.
