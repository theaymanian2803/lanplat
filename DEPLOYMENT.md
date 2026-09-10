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
| Production  | https://lingovault.vercel.app             |
| Link file   | `.vercel/project.json` (in this repo)     |

## Deploy (two commands)

```
npm run build
node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo
```

The script stages `dist` as Vercel's prebuilt output, uploads, and aliases
`lingovault.vercel.app` automatically.

## Versioning

Every deploy bumps the version in `package.json` and appends a row to
`deployments.md` (next to this file), so you always know which version is live:

| Bump                                   | Command                                                       |
|----------------------------------------|---------------------------------------------------------------|
| Default (patch, e.g. 1.2.3 → 1.2.4)    | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo` |
| Minor (1.2.3 → 1.3.0)                  | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo --minor` |
| Major (1.2.3 → 2.0.0)                  | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo --major` |
| Exact version                          | `node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo 2.1.0` |

The version is written to `package.json` **only after a successful deploy**.

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
- Never deploy a bare folder (`vercel deploy dist`) — it creates a stray
  project named `dist`. Always go through `deploy.mjs`.
- Redeploys don't touch Turso data or localStorage — saved settings survive.
- `sw.js` / `manifest.webmanifest` are regenerated on every build by
  `vite-plugin-pwa`; Vercel's root-file headers (`max-age=0, must-revalidate`)
  keep the service worker fresh.