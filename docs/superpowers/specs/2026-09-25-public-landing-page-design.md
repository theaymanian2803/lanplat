# Public Landing Page & Access Gate Re-architecture

Date: 2026-09-25

## Context

LingoVault is currently a private, single-user app. `/` is the media-library dashboard,
and `AccessGate` wraps the entire router in `src/App.tsx:36`, so every route requires a
PIN before anything renders.

We want a public marketing/hub page at `/` that:

- introduces the platform,
- previews and links to every learning module,
- lets a visitor pick a target language before entering the app,
- carries that language choice into the app so they land pre-filtered.

The password must protect the *application*, not the landing page.

## Decisions (approved)

1. **Static config, no DB reads on the landing page.** The Turso credentials ship inside
   the client bundle (`VITE_TURSO_*`), so anything the landing page queried would be
   readable by anyone who opens devtools. The landing page reads from a typed, checked-in
   manifest in `src/landing/` instead.
2. **Conjugation and grammar cards route to what exists.** There is no dedicated verb
   conjugation or grammar module. Conjugation is a `table` block inside a lesson; grammar
   is lesson text parts. Both cards link to `/lessons`.
3. **The language selection carries into the app.** Written to `localStorage` by the
   landing page, read by the dashboard and vocab bank to seed their existing filter.
4. **The access PIN remains a client-side curtain.** Making it a real wall requires an
   edge function holding a server-side secret plus a session cookie. Explicitly out of
   scope for this change.

## 1. Route & access restructure

### Current state

`src/App.tsx:36` wraps the whole `<BrowserRouter>` content in `AccessGate`. The seven
routes are declared in `src/App.tsx:41-47`, with `Index` (the dashboard) at `/`.

### Target route table

| Path            | Element                | Access |
| --------------- | ---------------------- | ------ |
| `/`             | `Landing` (new)        | public |
| `/dashboard`    | `Index` (moved from `/`) | gated |
| `/vocab`        | `VocabBank`            | gated |
| `/quiz`         | `FlashcardQuiz`        | gated |
| `/lessons`      | `LessonsPage`          | gated |
| `/languages`    | `Languages`            | gated |
| `/video/:id`    | `StudyRoom`            | gated |
| `*`             | `NotFound`             | public |

Implemented with a layout route so the guard has one declaration:

```tsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route element={<RequireAccess />}>
    <Route path="/dashboard" element={<Index />} />
    <Route path="/vocab" element={<VocabBank />} />
    <Route path="/quiz" element={<FlashcardQuiz />} />
    <Route path="/lessons" element={<LessonsPage />} />
    <Route path="/languages" element={<Languages />} />
    <Route path="/video/:id" element={<StudyRoom />} />
  </Route>
  <Route path="*" element={<NotFound />} />
</Routes>
```

Because `/vocab` is a layout-route child, a locked visitor who deep-links to `/vocab` sees
the code form and, on success, lands on `/vocab` — no redirect needed.

### Access primitives

`AccessGate.tsx` currently mixes three concerns. Split them:

**`src/lib/access.ts`** — all storage access, one home:

```ts
export const ACCESS_STORAGE_KEY = 'lingovault_unlocked'
export const isUnlocked = () => sessionStorage.getItem(ACCESS_STORAGE_KEY) === '1'
export const unlock = () => sessionStorage.setItem(ACCESS_STORAGE_KEY, '1')
export const lock = () => sessionStorage.removeItem(ACCESS_STORAGE_KEY)
```

The key name and the `sessionStorage` store are preserved verbatim. `e2e/add-word.spec.ts:38`
seeds `sessionStorage.setItem('lingovault_unlocked', '1')` and would break if either changed.

**`src/components/AccessCodeForm.tsx`** — the existing card UI, made presentational.
Props: `{ onUnlock: () => void }`. The code comparison (`AccessGate.tsx:20-28`) moves here,
still reading `getAccessCode()` from `src/lib/accessCode.ts`.

**`src/components/RequireAccess.tsx`** — the route guard. Holds `useState(isUnlocked)`,
renders `<AccessCodeForm onUnlock={...} />` or `<Outlet />`.

`src/components/AccessGate.tsx` is deleted. Nothing else imports it.

`src/components/Layout.tsx:40-43` (sign-out) switches from inline
`sessionStorage.removeItem` to `lock()`.

### Providers

`SettingsDialogProvider` and `OnboardingDialog` move **inside** the gated subtree — both are
application chrome (DB config, access-code editing, product tour) and neither belongs on the
public landing page. `ErrorBoundary` stays global so a landing-page crash is still caught.

### Bootstrap

`src/main.tsx:6-10` fires `ensureSchema()` and `flushSrsQueue()` on every page load. A
public visitor must make no Turso calls, so both move into a small `AppBootstrap` effect
component rendered inside the gated subtree, after unlock.

## 2. Landing data

New directory `src/landing/`, importing nothing from `integrations/turso`.

### `src/landing/types.ts`

```ts
import type { LucideIcon } from 'lucide-react'

export interface LandingStats {
  words: number
  decks: number
  lessons: number
}

export interface LandingLanguage {
  slug: string
  name: string
  tagline: string
  highlights: string[]
  stats: LandingStats
}

export interface LandingModule {
  id: string
  title: string
  description: string
  icon: LucideIcon
  to: string
  cta: string
}
```

### `src/landing/languages.ts`

Danish, Japanese and Spanish — the three languages seeded in
`src/integrations/turso/db.ts:152-159`. `name` must match the keys in
`src/lib/langColors.ts:1-15` exactly, so `getLangDotClass()` and `getLangBadgeClasses()`
supply per-language colour with no new colour definitions.

`stats` is a **hand-maintained curated snapshot**, not a live count. They live in one place
per language and are refreshed by editing this file. This is the accepted cost of keeping
the landing page free of live data. Each entry carries a comment marking the numbers as
curated, so nobody later mistakes them for a live query.

### `src/landing/modules.ts`

Five entries, each routed to a module that exists today:

| id            | title              | `to`          | rationale |
| ------------- | ------------------ | ------------- | --------- |
| `vocab`       | Vocabulary Banks   | `/vocab`      | dedicated page |
| `quizzes`     | Flashcard Quizzes  | `/quiz`       | dedicated page |
| `conjugation` | Verb Conjugation   | `/lessons`    | conjugation tables are `table` blocks in lessons |
| `grammar`     | Grammar Guides     | `/lessons`    | grammar is lesson text parts |
| `study-rooms` | Video Study Rooms  | `/dashboard`  | rooms are entered from the media grid |

Conjugation and grammar intentionally share a route but carry distinct copy, so the landing
page can describe both honestly.

## 3. Carrying the language into the app

**`src/lib/targetLanguage.ts`**:

```ts
const KEY = 'lingovault_target_language'
export const getTargetLanguage = (): string | null => localStorage.getItem(KEY)
export const setTargetLanguage = (name: string) => localStorage.setItem(KEY, name)
```

`localStorage`, not `sessionStorage`: the choice is a durable user preference, not an
unlock flag, and it is written *before* the visitor ever authenticates.

Consumers initialise their existing language filter from it. Both are one-line changes to an
existing `useState` initializer:

- `src/pages/Index.tsx:37` — `useState<string>('all')` → `useState<string>(() => getTargetLanguage() ?? 'all')`
- `src/pages/VocabBank.tsx:42` — `useState<string>("all")` → `useState<string>(() => getTargetLanguage() ?? "all")`

No new props, no context, no new state shape. `FlashcardQuiz` is SRS-driven and has no
language filter, so it is untouched. The filters are seeded on mount only; changing the
language in-app does not write back to `localStorage`.

### Accepted drift

Two drifts follow from the static manifest, both accepted:

1. A stale `targetLanguage` value names a language that no longer exists in the database. The
   filter `Select` then displays no selection and the list renders unfiltered, since both
   query functions pass `undefined` for the falsy/`'all'` case. The user picks a value and it
   self-corrects. No cleanup path is needed.
2. A language added at runtime through `/languages` does **not** appear on the landing page.
   The manifest is the source of truth for the landing page only; the database remains the
   source of truth for the app. Adding a language to the manifest is a one-line code change.

## 4. Page structure

`src/pages/Landing.tsx` composes sections and owns the selected-language state. It renders
its own chrome and does **not** use `src/components/Layout.tsx` (that renders the app navbar
with Sign out and Settings).

| File | Responsibility |
| ---- | -------------- |
| `src/components/landing/LandingNavbar.tsx` | wordmark, anchor links, "Enter the vault" CTA → `/dashboard` |
| `src/components/landing/LandingHero.tsx` | eyebrow, display headline, sub-copy, primary + secondary CTA |
| `src/components/landing/LanguagePicker.tsx` | language toggle; calls `setTargetLanguage` |
| `src/components/landing/FeatureGrid.tsx` | the module hub grid |
| `src/components/landing/ModuleCard.tsx` | one card, props `{ module: LandingModule }` |
| `src/components/landing/LandingHowItWorks.tsx` | three steps: pick a language → unlock → practise |
| `src/components/landing/LandingFooter.tsx` | closing links |

Each takes its data as props and holds no store logic, so sections can be reused or replaced
independently once the manifest grows.

`Landing` owns `const [language, setLanguage] = useState(getTargetLanguage())`, passes it
to `LanguagePicker` and `FeatureGrid` (so cards can reflect the selected language), and
anchors the sections with `id="modules"`, `id="languages"`, `id="how"`.

### Visual language

Reuse the app's existing recipes verbatim so the landing page reads as the same product:

- **Cards** — `rounded-2xl border border-border/40 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all` (from `src/pages/LessonsPage.tsx:190`)
- **Icon chip** — `rounded-xl border border-primary/30 bg-primary/5` (from `src/components/AccessGate.tsx:34`)
- **Eyebrows / labels** — `text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70`
- **Headings** — `font-display` (Fraunces), per `src/index.css:92`
- **Language colour** — `getLangDotClass` / `getLangBadgeClasses`
- **Grid** — `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`

Dark amber is already forced by `<html class="dark">` in `index.html:2`. The fixed radial
amber glow on `body` (`src/index.css:88-91`) means the hero inherits the app's ambient
lighting with no new gradient work.

## 5. Change surface

| File | Change |
| ---- | ------ |
| `src/App.tsx` | new route table; gate becomes a layout route; `SettingsDialogProvider` + `OnboardingDialog` + `AppBootstrap` move inside it |
| `src/components/AccessGate.tsx` | deleted, replaced by the three access primitives |
| `src/components/RequireAccess.tsx` | new |
| `src/components/AccessCodeForm.tsx` | new |
| `src/lib/access.ts` | new |
| `src/lib/targetLanguage.ts` | new |
| `src/landing/*` | new |
| `src/pages/Landing.tsx` | new |
| `src/components/landing/*` | new |
| `src/main.tsx` | drop `ensureSchema()` / `flushSrsQueue()` |
| `src/pages/Index.tsx` | seed language filter from `getTargetLanguage()` (line 37); `data-tour="dashboard-heading"` already present |
| `src/pages/VocabBank.tsx` | seed language filter from `getTargetLanguage()` (line 42) |
| `src/components/Navbar.tsx` | `to: "/"` → `/dashboard` (nav item line 20, wordmark line 39) |
| `src/components/OnboardingDialog.tsx` | `navigate('/')` → `navigate('/dashboard')` (line 93) |
| `src/components/Layout.tsx` | use `lock()` from `src/lib/access.ts` |
| `src/pages/NotFound.tsx` | `<a href="/">` → react-router `<Link>` |
| `index.html` | title, description, Open Graph tags for the public page |
| `vite.config.ts` | PWA `start_url` `/` → `/dashboard` so an installed app opens on the app, not the marketing page |

### Unaffected by design

- `e2e/add-word.spec.ts` — visits only `/vocab` and `/video/:id`, and seeds the preserved
  `lingovault_unlocked` sessionStorage key. No edit required.
- `src/pages/Index.test.tsx` — renders `Index` directly inside a `MemoryRouter`; asserts no
  URL. No edit required.

## 6. Testing

- `src/landing/languages.test.ts` — every language has non-empty `slug`, `name`, `tagline`,
  at least one highlight, and numeric stats. Slugs are unique.
- `src/lib/targetLanguage.test.ts` — `setTargetLanguage` / `getTargetLanguage` roundtrip.
- `src/components/RequireAccess.test.tsx` — locked renders the code form and no outlet;
  seeding `lingovault_unlocked` in `sessionStorage` renders the outlet.
- `src/pages/Landing.test.tsx` — hero renders, all five module cards render, selecting a
  language marks it active and writes to `localStorage`.

Verification before completion: `npm run lint`, `npx tsc -b`, `npm run test`, `npm run build`.

## 7. Out of scope

- **Real authentication.** The PIN stays client-side. A genuine wall needs an edge function
  with a server-held secret and a session cookie.
- **Building dedicated verb conjugation or grammar modules.** Both cards point at
  `/lessons` until those exist.
- **Any database read or write from the landing page.**
- **A light/dark theme toggle.** Dark stays hardcoded.
- **SEO beyond `index.html` meta tags.** No prerendering, no sitemap, no per-language URLs.
