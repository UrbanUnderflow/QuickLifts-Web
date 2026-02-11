# Netlify Routing Fix for Next.js

## The Problem

**Symptom:** Clicking links shows "Page not found", but reloading the same URL works fine.

This happens because of conflicting redirect rules fighting with Next.js routing on Netlify.

## Root Cause

When you use `@netlify/plugin-nextjs` (which we do), the plugin automatically handles **all** Next.js routing — including:
- Static pages (`/about`, `/pricing`)
- Dynamic pages (`/profile/[userId]`, `/round/[id]`)
- API routes (`/api/*`)
- Admin pages (`/admin/*`)

### What breaks it

Adding SPA-style redirect rules like these in `netlify.toml` or `public/_redirects`:

```toml
# ❌ DO NOT ADD THESE — they break Next.js routing
[[redirects]]
  from = "/admin/*"
  to = "/"
  status = 200

[[redirects]]
  from = "/*"
  to = "/"
  status = 200
```

Or in `public/_redirects`:
```
# ❌ DO NOT ADD THESE
/admin/*  /  200
/*  /  200
```

### Why it breaks

These rules tell Netlify: *"When someone navigates to `/admin/agentChat`, serve the root `/` page instead."*

- **Hard refresh works** because the browser loads `/`, Next.js client-side router sees the URL, and renders the correct component.
- **Direct navigation fails** because some link types trigger a full server request, and Netlify serves the wrong page (or the root page doesn't match the expected route).

The `@netlify/plugin-nextjs` plugin generates its own redirect/rewrite rules during build that correctly map every route. Manual redirects override the plugin's rules and break things.

## The Fix

### 1. Delete `public/_redirects` (if it exists)

```bash
rm public/_redirects
```

This file is unnecessary when using `@netlify/plugin-nextjs`. The plugin generates its own redirect rules.

### 2. Remove SPA redirect rules from `netlify.toml`

Remove any redirect rules that send page routes to `/`:

```toml
# ❌ REMOVE these
[[redirects]]
  from = "/profile/*"
  to = "/"
  status = 200

[[redirects]]
  from = "/round/*"
  to = "/"
  status = 200

# ... etc
```

### 3. Keep legitimate function rewrites

The only redirects you should keep are **function rewrites** — these route a clean URL to a Netlify function:

```toml
# ✅ These are fine — they rewrite to functions, not to "/"
[[redirects]]
  from = "/og-image.png"
  to = "/.netlify/functions/og-image"
  status = 200
  force = true
```

### 4. Clear cache and redeploy

```bash
rm -rf .next
npm run build
# or: git push (to trigger Netlify deploy)
```

## What the correct `netlify.toml` looks like

```toml
[build]
  command = "next build"
  publish = ".next"
  functions = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# ✅ Function rewrites only
[[redirects]]
  from = "/og-image.png"
  to = "/.netlify/functions/og-image"
  status = 200
  force = true

# ❌ NO SPA catch-all redirects
# ❌ NO public/_redirects file
# The @netlify/plugin-nextjs handles everything automatically
```

## Quick Checklist

| Check | Status |
|-------|--------|
| `public/_redirects` does NOT exist | ✅ |
| No `/* → / 200` in `netlify.toml` | ✅ |
| No `/admin/* → / 200` in `netlify.toml` | ✅ |
| `@netlify/plugin-nextjs` is in `[[plugins]]` | ✅ |
| `publish = ".next"` (not `"out"`) | ✅ |

## Prevention

If you ever add a new page route and it 404s on production:
1. **Do NOT** add a redirect rule as a fix
2. **Do** check that the page file exists in `src/pages/`
3. **Do** check that `npx next build` succeeds
4. **Do** redeploy — the plugin will pick up new routes automatically
