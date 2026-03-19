# SuperService

A universal service marketplace connecting seekers with verified providers.

## Product Docs

- Platform specification: `docs/platform-spec.md`
- MVP roadmap: `docs/mvp-roadmap.md`

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Database, Edge Functions)

## Environment Variables

For deployment (e.g. Vercel), set these environment variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |
| `VITE_WEB_PUSH_PUBLIC_KEY` | VAPID public key used by browser Push API subscription |

## Local Development

```sh
npm install
npm run dev
```

## Deployment on Vercel

1. Connect your GitHub repository to Vercel
2. Add the environment variables above in Vercel → Settings → Environment Variables
3. Deploy

## Offline/Background Push Setup

This project now includes full web-push plumbing for offline/background notifications:

- Service worker: `public/web-push-sw.js`
- Frontend push subscription registration: `src/lib/pushNotifications.ts`
- Supabase Edge Function sender: `supabase/functions/send-web-push/index.ts`
- DB migration for subscriptions + trigger webhook dispatch: `supabase/migrations/20260319153000_background_web_push_notifications.sql`

### 1. Generate VAPID keys

Use any web-push VAPID generator. Example with Node:

```sh
npx web-push generate-vapid-keys
```

### 2. Configure web app env

Set the public key in your frontend env:

```dotenv
VITE_WEB_PUSH_PUBLIC_KEY="<your-vapid-public-key>"
```

### 3. Configure Supabase Edge Function secrets

Set these in Supabase project secrets:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (example: `mailto:ops@yourdomain.com`)
- `PUSH_WEBHOOK_SECRET` (random shared secret)

### 4. Deploy the new Edge Function

```sh
supabase functions deploy send-web-push
```

### 5. Enable DB webhook dispatch settings

After migration is applied, update `public.push_notification_settings` once:

```sql
update public.push_notification_settings
set
	enabled = true,
	webhook_url = 'https://<your-project-ref>.supabase.co/functions/v1/send-web-push',
	webhook_secret = '<same PUSH_WEBHOOK_SECRET>'
where id = true;
```

When enabled, booking insert/status/payment transitions trigger server-side push sends, so notifications still arrive while the app is closed.
