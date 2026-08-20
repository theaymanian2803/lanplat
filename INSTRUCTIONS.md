# LingoVault — Setup & Deployment Guide

Thank you for purchasing LingoVault! This guide takes you from a fresh ZIP to a live,
hosted language learning dashboard.

---

## Table of Contents

1. [What's in the box](#1-whats-in-the-box)
2. [Requirements](#2-requirements)
3. [Extract & install](#3-extract--install)
4. [Create your Turso database](#4-create-your-turso-database)
5. [Run locally](#5-run-locally)
6. [Production build](#6-production-build)
7. [Change the access code](#7-change-the-access-code)
8. [Push to GitHub](#8-push-to-github)
9. [Deploy to a host](#9-deploy-to-a-host)
10. [Environment variables](#10-environment-variables)
11. [Customization](#11-customization)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What's in the box

- **`lingo.zip`** — the complete, ready-to-run source code of the template.
- **`INSTRUCTIONS.md`** — this guide.

The ZIP contains the frontend source only (`src/`, `public/`, config files, package manifest).
It does **not** contain `node_modules`, `dist`, `.git`, or your private `.env` file.

## 2. Requirements

- **Node.js 18+** (Node 20 LTS recommended) — <https://nodejs.org>
- **npm** — installed automatically with Node
- A **free Turso account** for the cloud database (2-minute setup, step 4)

Check your versions:

```bash
node -v
npm -v
```

## 3. Extract & install

1. Unzip `lingo.zip` into a folder, e.g.:

   ```bash
   mkdir lingovault && cd lingovault
   unzip lingo.zip
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

## 4. Create your Turso database

The app stores all of its data (videos, vocabulary, notes, screenshots, languages) in a
free cloud SQLite database powered by [Turso](https://turso.tech). Your data is **yours**
— it lives in your database, not on a server you have to run.

1. Go to <https://turso.tech> and sign in (free plan is enough).
2. Click **Databases → Create database**. Give it a name (e.g. `lingovault`) and pick a
   location. Create it.
3. On the database page, copy the **URL** (it starts with `libsql://...`).
4. Generate (or copy) an **auth token** from the same page.

Keep both values — you'll paste them into a `.env` file next.

### Set up the .env file

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

   (On Windows Command Prompt: `copy .env.example .env`)

2. Open `.env` and fill in your two values:

   ```env
   VITE_TURSO_DATABASE_URL=libsql://your-database-username-orgname.aws-<region>.turso.io
   VITE_TURSO_AUTH_TOKEN=eyJ...your_long_token
   ```

> **Never commit `.env`.** It is already listed in `.gitignore`, so it will be ignored by Git automatically.

The database schema and the starter languages (Danish, Japanese, Spanish) are created
automatically the first time the app loads — nothing else to set up.

## 5. Run locally

```bash
npm run dev
```

Open the URL printed in the terminal (default: `http://localhost:8080`).
You'll be asked for the access code — the default is `123123123` (see step 7 to change it).

## 6. Production build

```bash
npm run build
npm run preview
```

- `npm run build` compiles the app into a static `dist/` folder.
- `npm run preview` serves it locally so you can test the production build.
- Tests (if you keep the template's test setup): `npm run test`.

## 7. Change the access code

The app is protected by a client-side access code (no login/account system).

1. Open `src/components/AccessGate.tsx`.
2. Change the value on line 8:

   ```ts
   const ACCESS_CODE = '123123123'
   ```

3. Save and rebuild.

> Note: because this is a client-side gate, the code is visible in the shipped JavaScript
> bundle. It's designed to keep out casual visitors, not to be a security boundary.

## 8. Push to GitHub

1. Create a new empty repository on GitHub (don't initialize it with a README).
2. In your project folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit of LingoVault"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

`.gitignore` already excludes `node_modules`, `dist`, `.env`, and build artifacts — so
secrets never end up in the repository.

## 9. Deploy to a host

The build output is fully static, so it runs on virtually any host. Pick one:

### Option A — Vercel (recommended)

**Via Git (automatic deploys on push):**

1. Go to <https://vercel.com/new> and import your GitHub repository.
2. Vercel auto-detects **Vite**. Defaults are already correct (Build: `npm run build`,
   Output: `dist`).
3. In **Settings → Environment Variables**, add:
   - `VITE_TURSO_DATABASE_URL` = your Turso URL
   - `VITE_TURSO_AUTH_TOKEN` = your Turso token
4. Click **Deploy**. Deep links like `/video/...` work because `vercel.json` (included)
   rewrites all routes to `index.html`.

**Via CLI (no GitHub needed):**

```bash
npm install -g vercel
npm run build
cd dist
vercel deploy --prod
```

**Via Vercel Drop (quick test):** go to <https://vercel.com/drop> and drag the `dist`
folder (or the whole project folder) into the browser.

### Option B — Netlify

1. Go to <https://app.netlify.com/start> and import your GitHub repository.
2. Set:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Add the same two environment variables (`VITE_TURSO_DATABASE_URL`,
   `VITE_TURSO_AUTH_TOKEN`).
4. Deploy. The included `public/_redirects` file makes deep links (e.g. refreshing
   `/video/...`) work correctly.

**CLI alternative:** `npm install -g netlify-cli`, then `netlify deploy --dir=dist --prod`.

### Option C — Hostinger (shared hosting / cPanel)

1. Build the app locally: `npm run build`.
2. In Hostinger **hPanel**, open **File Manager** (or connect via FTP) and upload the
   **contents of `dist/`** into `public_html/`.
3. Done. The included `.htaccess` handles client-side routing, so deep links work.

> If you deploy a fresh build, the Turso environment variables are already baked into the
> JavaScript — the static upload needs no extra configuration.

### Option D — Any static host (Cloudflare Pages, GitHub Pages, etc.)

1. Build: `npm run build`.
2. Upload/point the host at the `dist/` folder.
3. Ensure the host supports SPA fallback (single-page redirect to `index.html`) so deep
   links resolve. The platform-specific files included (`vercel.json`, `public/_redirects`,
   `public/.htaccess`) cover Vercel, Netlify, and Apache-based hosting.

## 10. Environment variables

| Variable                 | Required | Description                          | Example                                        |
| ------------------------ | -------- | ------------------------------------ | ---------------------------------------------- |
| `VITE_TURSO_DATABASE_URL`| Yes      | Your Turso database URL              | `libsql://lingovault-username.aws-eu.turso.io` |
| `VITE_TURSO_AUTH_TOKEN`  | Yes      | Turso authentication token (read/write) | `eyJ...`                                     |

These are Vite **build-time** variables: they are inlined into the bundle when you run
`npm run build`. Set them before building, and set them in your host's environment
variables for Git-based deploys.

## 11. Customization

- **App name / branding:** edit `index.html` (`<title>`, meta tags) and the logo/text
  components under `src/components/`.
- **Colors & theme:** the design tokens are CSS variables in `src/index.css` and the
  Tailwind theme in `tailwind.config.ts`.
- **Starter languages:** edited from the **Languages** page in the app (stored in the
  database) or seeded in `src/integrations/turso/db.ts`.
- **YouTube player behavior:** `src/pages/StudyRoom.tsx` (A-B loop, error fallback).

## 12. Troubleshooting

| Problem                                        | Fix                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| Blank page / "Failed to initialize database"   | Check `.env` values; verify the token is valid in the Turso dashboard. |
| App loads but data never appears               | Confirm the database was created and the URL/token match `.env`.    |
| 404 on refresh of a deep link                  | The host's SPA fallback isn't configured — see section 9 for the platform file. |
| YouTube video won't play                       | The uploader may have disabled embedding; the app shows a "Watch on YouTube" fallback. Region/extension blockers can also cause this. |
| `npm run dev` port is busy                     | Vite automatically picks the next available port; use the printed URL. |
| Access code forgotten                          | Reset it in `src/components/AccessGate.tsx` and rebuild.            |

---

Enjoy LingoVault! For help with anything not covered here, keep this guide and the source
structure in mind — every major setting is documented above or in the `README.md`.
