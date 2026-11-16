# Graffiti website deployment

This guide targets the current `website-redesign/` site served locally at `127.0.0.1:4335`; the older `website/` tree is not part of this deployment.

The site remains a statically generated Astro site. Cloudflare Workers serves the generated `dist/` directory through the static-assets binding, while the Worker handles `/api/*`. No Astro SSR adapter is used.

## What is already in the repository

- `wrangler.jsonc` configures the Worker, static assets, D1 binding, and `/api/*` worker-first routing.
- `migrations/0001_create_feedback.sql` creates the base feedback table and visible-entry index.
- `migrations/0002_admin_feedback_analytics.sql` adds categories, read state, votes, visitor-day tracking, and analytics events.
- `src/worker/index.js` implements the public feedback/vote API, analytics events, admin API, Turnstile verification, and throttling.
- `.dev.vars.example` documents local Worker variables.
- `.env.example` documents the public build-time Turnstile site key.
- `wrangler.jsonc` names the public Worker `graffiti-wall`; the deployed hostname printed by Cloudflare remains the source of truth for the admin app's `VITE_GRAFFITI_API_URL`.

The production D1 database is already created as `graffiti-feedback` with ID `28ecaf14-ad01-4278-9fa8-23087bc8c01f`, and both migrations are applied remotely. The local development database remains separate.

## Phase A — workers.dev deployment

Run these commands from `website-redesign/` in PowerShell. The commands that open a browser or prompt for a value require the site owner's Cloudflare login and approval.

```powershell
cd C:\My_Proj\InteractWall\website-redesign
npm install
npx wrangler login
```

If `CLOUDFLARE_ACCOUNT_ID` is already set in your shell, make sure it is the Graffiti account before running account-dependent commands:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "6d99e61134044130336903801da3f746"
```

The remote schema is already applied. If it ever needs to be reapplied on a fresh database, use:

```powershell
npx wrangler d1 migrations apply graffiti-feedback --remote
```

For the first deployment, use the published test site key or a temporary placeholder to obtain the `workers.dev` hostname. Feedback submission will remain unavailable until the production Turnstile values are configured. The site key is public, but it is still supplied as build configuration so it can change without editing the component:

```powershell
$env:PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000BB"
npm run build:worker
npx wrangler deploy --dry-run
npx wrangler deploy
```

Cloudflare prints the `workers.dev` URL after the first deploy. Create a real Turnstile widget for that hostname, then set the Worker secrets. These values never belong in Git:

```powershell
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put ALLOWED_ORIGINS
$env:PUBLIC_TURNSTILE_SITE_KEY = "<production-turnstile-site-key>"
npm run build:worker
npx wrangler deploy
```

For the website, include the deployed `https://...workers.dev` origin in `ALLOWED_ORIGINS`. Include `http://tauri.localhost` and `tauri://localhost` for the local Tauri admin console. The admin console sends `ADMIN_TOKEN` in `X-Admin-Token` and does not require a hosted admin page.

## Local Worker and D1 development

Copy the examples without committing the resulting files:

```powershell
Copy-Item .dev.vars.example .dev.vars
Copy-Item .env.example .env
```

Replace `ADMIN_TOKEN` in `.dev.vars` with any local-only value. The example uses Cloudflare's published always-pass Turnstile test keys. Build the static site, apply the local migrations, and start the Worker:

```powershell
npm run build:worker
npx wrangler d1 migrations apply graffiti-feedback --local
npx wrangler dev --local --port 8787
```

Open `http://127.0.0.1:8787/`. This Worker origin serves both the static assets and `/api/*`, so no CORS configuration is needed.

## Standalone admin app

The admin console is a separate Tauri application. It is not hosted and it does not use email. Build it from the repository root with `build_admin.bat`, install `downloads\GraffitiAdmin_1.0.0_x64-setup.exe`, enter the deployed Worker URL and the `ADMIN_TOKEN`, then refresh the dashboard. The app sends the token in the `X-Admin-Token` header; the Worker also accepts a bearer token for direct API clients.

The Worker must include both the website origin and the standalone admin app's local Tauri origins in `ALLOWED_ORIGINS`, for example:

```text
https://app.graffiti-wall.workers.dev,http://tauri.localhost,tauri://localhost
```

The app can filter feedback by All, Thought, Bug, Question, and Idea; show unread feedback; mark entries read/unread; change categories; hide/restore entries; and display visitor, download, feedback, and vote totals.

## Smoke tests

With `npx wrangler dev --local --port 8787` running in another terminal, use the commands in the repository verification notes or the following request shape:

```powershell
$body = @{ rating = 5; category = "Thought"; name = "Local tester"; message = "Works locally"; website = ""; turnstileToken = "XXXX.DUMMY.TOKEN.XXXX" } | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:8787/api/feedback -Method Post -Headers @{ Origin = "http://127.0.0.1:8787"; "Content-Type" = "application/json" } -Body $body
Invoke-WebRequest "http://127.0.0.1:8787/api/feedback?limit=20"
```

The automated session also runs checks for oversized messages, invalid ratings/categories, missing Turnstile, wrong Origin, honeypot input, HTML-as-text, the 30-per-10-minute throttle, votes, analytics events, admin authorization, category updates, and read-state updates.
