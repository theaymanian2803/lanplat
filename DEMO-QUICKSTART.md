# LingoVault — 2-Minute Quickstart (no code needed)

This is the **ready-to-run demo** of LingoVault. No Node.js, no terminal, no database
setup — just upload the files and go.

## What you got

- `DEMO-QUICKSTART.md` — this file
- `index.html` + `assets/` — the fully built website (works out of the box)

> The site runs on a **shared demo database**, so you can try everything immediately
> with sample data. Your changes are visible to everyone on the demo — when you want
> your own private data, see "Connect your own database" below.

## How to get it live (pick one)

### Option A — Vercel (easiest, recommended)

1. Unzip this folder.
2. Go to **<https://vercel.com/drop>** and drag the whole unzipped folder into the
   browser.
3. Wait ~30 seconds for the deploy, then open the URL Vercel gives you.

### Option B — Netlify

1. Unzip this folder.
2. Go to **<https://app.netlify.com/drop>** and drag the whole unzipped folder in.
3. Done — Netlify serves it as a static site.

### Option C — any static host

Upload the contents of this folder to any static host (Cloudflare Pages, GitHub
Pages, cPanel, S3, etc.). The site is a single-page app, so make sure the host
redirects unknown routes to `index.html` (Vercel/Netlify do this automatically).

## Using the app

1. Open your new URL — you'll be asked for an **access code**: `123123123`
2. Add a language, add videos, build your vocabulary bank, run quizzes, and track
   lessons — everything is stored in the cloud demo database.

## Connect your own database (optional)

Want your own private data? Click **Settings → Database Settings** in the app and
paste your Turso database URL + token (free at <https://turso.tech>). No rebuild
needed — it saves instantly.

---

For the full developer setup (source code, custom access code, self-hosting from
source), see `INSTRUCTIONS.md` in the source package.