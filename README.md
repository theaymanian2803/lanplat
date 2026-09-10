# LingoVault

A premium, self-hosted language learning dashboard. Manage study videos with a built-in video player and A-B loop, a vocabulary bank with spaced-repetition flashcards, study notes, and screenshots — all stored in a free Turso (libSQL) cloud database. No auth backend required (single local user behind an access code).

## Features

- **Study Room** — YouTube playback with A-B loop, speed + caption controls, drawing overlay, time-stamped notes and screenshots.
- **Vocab Bank** — add words per language, search/filter, and export.
- **Flashcard Quiz** — spaced-repetition (SRS) flashcard drills.
- **Languages page** — manage your target languages (stored in the database).
- **Access gate** — simple client-side PIN to unlock the app.
- **Dark, responsive UI** built with React, TypeScript, Tailwind CSS, shadcn/ui and Radix primitives.

## Tech Stack

React 18 · Vite 5 · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · Turso (libSQL) · react-router

## Quick Start

```bash
npm install
# create your free Turso database, then:
cp .env.example .env   # fill in VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN
npm run dev
```

The database schema and starter languages are created automatically on first load.

## Deployment (Vercel)

LingoVault is hosted on Vercel at **https://lingovault.vercel.app**. Deploying is two commands:

```bash
npm run build
node C:\Users\PC\Desktop\workflow\deploy.mjs C:\Users\PC\Desktop\lingo
```

Each deploy bumps the version in `package.json` and appends a row to `deployments.md`, so you always know which version is live. Full details — project identity, version bumps, troubleshooting, and gotchas — are in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Docs

Full step-by-step instructions — local setup, GitHub push, and deployment options — are in **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**. The Vercel-specific workflow lives in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Scripts

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (port 8080)          |
| `npm run build`    | Production build to `dist/`                    |
| `npm run preview`  | Serve the production build locally             |
| `npm run test`     | Run unit tests                                 |
| `npm run package`  | Build the distributable `lingo/lingo.zip`      |
