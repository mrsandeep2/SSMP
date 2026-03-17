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

## Local Development

```sh
npm install
npm run dev
```

## Deployment on Vercel

1. Connect your GitHub repository to Vercel
2. Add the two environment variables above in Vercel → Settings → Environment Variables
3. Deploy
