---
name: Supabase project credentials
description: Supabase project endpoint — env var names only, no values.
---

# Supabase Project

Credentials are stored as Replit shared env vars:
- `VITE_SUPABASE_URL` — the project REST endpoint
- `VITE_SUPABASE_ANON_KEY` — the public anon JWT

Payment server secret: `FLW_SECRET_KEY` is stored as a Replit Secret (used by `server/index.js`).

**Why:** Vite requires the `VITE_` prefix to expose env vars to the browser bundle. The anon key is public by design (row-level security enforces access); it is safe as a non-secret env var.
