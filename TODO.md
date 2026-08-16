# TODO — Port DB-Settings module to the other templates

## What was done (lingo — COMPLETE)
Runtime Turso database settings added to lingo:
- `src/lib/tursoConfig.ts` — localStorage config store, falls back to baked-in demo DB
- `src/integrations/turso/client.ts` — lazy `getTursoClient()` + `resetTursoClient()` + `testTursoConnection()`
- `src/integrations/turso/db.ts` — client now built from runtime config (all `turso.*` calls unchanged)
- `src/components/TursoSettingsDialog.tsx` — Settings dialog (URL + token, connection test on save, "Reset to demo")
- `Navbar.tsx` — Settings button; `Layout.tsx` — dismissible first-run banner when on demo DB
- Verified: tsc, eslint, vite build all pass; demo URL + token still baked into `dist`

## Next session — port to the other templates
The marketplace website CANNOT inject this — each template is deployed independently by the buyer.
The settings screen must live inside each template's code. It's 5 small files, near copy-paste.

### Step 1 — confirm the target list
Desktop folders confirmed to use Turso (`@libsql/client` + `VITE_TURSO_*`):
- lingo (done)
- salon
- maison
- prompty
- promptingsite
- "bike replet two"
- replitcamp

→ Ask the user which of these are the 5 templates actually listed on the store (question was
  dismissed last time). Also confirm none of the 5 use a different backend (Supabase/Firebase).

### Step 2 — port per template
For each target template:
1. Copy `src/lib/tursoConfig.ts` (update storage keys, e.g. `salon_turso_config`).
2. Copy the refactored `src/integrations/turso/client.ts` (lazy + test + reset).
3. Update `db.ts` — `const turso = getTursoClient()` at top (keep all `turso.*` calls).
4. Copy `src/components/TursoSettingsDialog.tsx` (adjust imports if paths differ).
5. Wire into the template's navbar + layout (Settings button + first-run banner).
6. Verify: `npx tsc --noEmit`, `npx eslint <changed files>`, `npx vite build`.
7. Rebuild `dist`, re-run packaging scripts, redeploy.

### Step 3 (optional) — marketplace complement
templatepro HostingWizard: add a "create your Turso database" step (French, WhatsApp 212694784176)
so buyers arrive at the template with credentials ready.
