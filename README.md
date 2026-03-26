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

`npm run dev:fast` starts the app through Netlify Dev in offline mode and links the slim local functions setup used by this repo.

`npm run dev:fast:online` uses the same slim local functions setup but keeps Netlify API access enabled for cases where you specifically need remote project metadata.

`npm run dev:full` starts Netlify Dev in offline mode with the full functions directory.

## Notes

- The active web app lives in `src/pages` and `src/components`.
- Deployment is configured through [`netlify.toml`](./netlify.toml).
- Environment variables should be managed through local `.env` files and the Netlify UI, not committed into the repo.
