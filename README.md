# QuickLifts-Web

QuickLifts-Web is the production Next.js web app for Pulse. The current app runs as a single Next Pages Router project under `src/pages`, with Netlify functions in `netlify/functions`.

## Requirements

- Node.js 20.x
- npm
- Netlify CLI if you need local function emulation

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in the values in `.env.local` before running the app.

## Common Commands

```bash
npm run dev
npm run dev:fast
npm run build
npm run typecheck
npm run lint
npm run env-check
npm run test:e2e
```

`npm run dev` starts the Next app directly.

To manage the existing production partner keys from `/admin/partner-api-keys`
locally, set `LOCAL_PARTNER_API_USE_PRODUCTION=true` in `.env.local` and restart
the dev server. Sign in with a production administrator account and select
Production database. Only this API route is forwarded to `fitwithpulse.ai`;
production still verifies the signed-in administrator and handles encryption.
The page shows live production records, and actions change those real records.
No production server credentials or encryption keys need to be copied locally.
This forwarding is disabled in production builds and when the flag is absent.

`npm run dev:fast` starts the app through Netlify Dev in offline mode and links the slim local functions setup used by this repo.

`npm run dev:fast:online` uses the same slim local functions setup but keeps Netlify API access enabled for cases where you specifically need remote project metadata.

`npm run dev:full` starts Netlify Dev in offline mode with the full functions directory.

## Notes

- The active web app lives in `src/pages` and `src/components`.
- Deployment is configured through [`netlify.toml`](./netlify.toml).
- Environment variables should be managed through local `.env` files and the Netlify UI, not committed into the repo.
