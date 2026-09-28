# Deployment — LingoVault

How to push this project to production on Vercel. Companion to the shared
workflow in `C:\Users\PC\Desktop\workflow` (README + deploy script + docs).

## Project identity

| Field       | Value                                    |
|-------------|------------------------------------------|
| Team slug   | `codys-projects-43132bcc`                |
| Org ID      | `team_E2IMoT81InTSRJdTq8LyCqbx`          |
| Project     | `lingovault`                             |
| Project ID  | `prj_G9MYYcGfXbnv4f8ek0qQXrzZuBZJ`       |
| Production  | https://languageplatform.unccode.site     |
| Git repo    | https://github.com/theaymanian2803/lanplat |

## Deploy (auto, on every GitHub push)

The project is connected to the GitHub repo above, so **every push to `main`
deploys to production automatically** — no local build, no CLI. Vercel runs
`npm run build`, compiles the `api/` serverless functions, applies
`vercel.json` rewrites (including `/gutenberg/*` → `/api/book-text`), and
updates the custom domain.

## One-time setup (only needed once, in the Vercel dashboard)

1. **Connect the repo** — Vercel dashboard → the `lingovault` project (the one
   serving `languageplatform.unccode.site`) → Settings → Git → Connect
   repository → `theaymanian2803/lanplat`.
2. **Add the Turso env vars** — Settings → Environment Variables →
   `VITE_TURSO_DATABASE_URL` and `VITE_TURSO_AUTH_TOKEN` (values from the local
   `.env`) for Production + Preview + Development. `.env` is gitignored, so
   without this the deployed build has no database credentials.
3. Push once to trigger the first build, then verify `/books` works.

## CLI fallback (if Git integration is unavailable)

```
npm run build
node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo
```

The script stages `dist` as Vercel's prebuilt output, uploads, and aliases
`lingovault.vercel.app` automatically.

## Versioning

Every `deploy.mjs` run bumps the version in `package.json` and appends a row to
`deployments.md` (next to this file), so you always know which version is live:

| Bump                                   | Command                                                       |
|----------------------------------------|---------------------------------------------------------------|
| Default (patch, e.g. 1.2.3 → 1.2.4)    | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo` |
| Minor (1.2.3 → 1.3.0)                  | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo --minor` |
| Major (1.2.3 → 2.0.0)                  | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo --major` |
| Exact version                          | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo 2.1.0` |

The version is written to `package.json` **only after a successful deploy**.

> Note: the version bump/log only happens on CLI deploys. Git-connected deploys
> deploy whatever is on `main` without bumping the version.

## If it fails with "Not authorized"

The `lingovault` project was likely deleted from Vercel. Recreate it (run in
this folder):

```
npx --yes vercel whoami
npx --yes vercel project ls --scope codys-projects-43132bcc
npx --yes vercel project add lingovault --scope codys-projects-43132bcc
npx --yes vercel link --yes --scope codys-projects-43132bcc --project lingovault
npm run build
node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo
```

## Gotchas

- **`vercel link` overwrites `.env.local`** — Turso credentials live in `.env`
  (`VITE_TURSO_DATABASE_URL`, `VITE_TURSO_AUTH_TOKEN`), which Vite falls back
  to, so the build still bakes them. Do NOT delete `.env`.
- **Git builds need the env vars in the dashboard** — `.env` never leaves the
  machine; without the two `VITE_TURSO_*` variables in Settings → Environment
  Variables, the deployed app loses its database.
- Never deploy a bare folder (`vercel deploy dist`) — it creates a stray
  project named `dist`. Always go through `deploy.mjs` (or Git).
- Redeploys don't touch Turso data or localStorage — saved settings survive.
- `sw.js` / `manifest.webmanifest` are regenerated on every build by
  `vite-plugin-pwa`; Vercel's root-file headers (`max-age=0, must-revalidate`)
  keep the service worker fresh.