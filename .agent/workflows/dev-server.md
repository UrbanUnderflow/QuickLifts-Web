---
description: How to start the local dev server (fast vs full mode)
---

# Dev Server

## Fast Start (recommended for daily dev)

```bash
npm run dev:fast
```

Only symlinks essential Netlify functions → much faster startup.

## Full Start (all functions)

```bash
npm run dev:full
```

Compiles every Netlify function. Use when testing a specific serverless endpoint.

## Standard (default Netlify behavior)

```bash
netlify dev
```
