# Public Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` a public landing page that introduces LingoVault, links to every learning module, and carries a visitor's language choice into the gated app.

**Architecture:** `AccessGate` is split into a storage module, a presentational code form, and a route-layout guard, so `/` renders without a code while six app routes stay gated behind it. The landing page reads from a typed static manifest in `src/landing/` and never touches Turso — the Turso credentials ship in the client bundle, so any DB read on a public page would leak the data. A `targetLanguage` preference in `localStorage`, written by the landing page before authentication, seeds the dashboard and vocab bank filters on mount.

**Tech Stack:** React 18, TypeScript (`strict: false`), Vite 5, Tailwind 3 with the warm-amber dark theme, shadcn/ui, `lucide-react@0.462`, react-router-dom 6, TanStack Query 5, Vitest 3 + Testing Library, Playwright 1.57.

**Spec:** `docs/superpowers/specs/2026-09-25-public-landing-page-design.md`

## Global Constraints

- **Never rename `ACCESS_STORAGE_KEY` or move it off `sessionStorage`.** `e2e/add-word.spec.ts:38` seeds `sessionStorage.setItem('lingovault_unlocked', '1')` to bypass the gate. Breaking either breaks that spec.
- **`src/landing/` must not import from `src/integrations/turso/`.** The landing page is public; a DB import there is a data leak.
- **The `name` field of every entry in `src/landing/languages.ts` must be a key in `src/lib/langColors.ts`.** That is what supplies per-language colour. The three names are `Danish`, `Japanese`, `Spanish` (seeded at `src/integrations/turso/db.ts:152-159`).
- **Stats in `src/landing/languages.ts` are curated, not live.** The manifest carries a file-level JSDoc above the array saying so. (An earlier draft of this constraint demanded a comment on each individual entry; the code block places one JSDoc above the array, and the code block is the authority.)
- **Reuse the app's visual recipes verbatim**, do not invent new ones:
  - Feature card: `rounded-2xl border border-border/40 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all` (from `src/pages/LessonsPage.tsx:190`)
  - Icon chip: `rounded-xl border border-primary/30 bg-primary/5` (from `src/components/AccessGate.tsx:34`)
  - Eyebrow/label: `text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70`
  - Headings: `font-display` (Fraunces), applied globally by `src/index.css:92`
  - Grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- **Dark mode is hardcoded** via `<html class="dark">` (`index.html:2`). Do not add a theme toggle.
- **The `Landing` page must not use `src/components/Layout.tsx`** — that renders the app navbar with Sign out and Settings.
- Only these `lucide-react` icons are verified to exist in the installed version: `arrow-right`, `book-marked`, `book-open`, `check`, `chevron-right`, `circle-check`, `database`, `film`, `graduation-cap`, `languages`, `layers`, `library`, `list-checks`, `lock-keyhole`, `play`, `shield-check`, `sparkles`, `table-2`, `target`, `trending-up`, `zap`. Do not use any icon outside this list without first checking `node_modules/lucide-react/dist/esm/icons/<kebab-name>.js` exists.
- **Verification before a task is called done:** the task's own test file must pass, and the full suite `npx vitest run` must stay green. `npm run lint` and `npx tsc -b` are **not** clean on `main` and are not this change's to fix — the baseline is 6 pre-existing `tsc` errors in `src/components/LessonsPanel.tsx` and `src/pages/LessonsPage.tsx` (TanStack Query v5 overloads) plus 9 pre-existing `eslint` errors in untouched files. The gate is therefore **no NEW errors**: run `npx eslint <the files you created or changed>` and confirm it exits 0, and confirm `npx tsc -b` reports no error in any file you created or changed. Do not fix the pre-existing errors; unrelated refactoring is out of scope for this plan.

---

## File Structure

**New — access primitives**
- `src/lib/access.ts` — the unlock flag. `ACCESS_STORAGE_KEY`, `isUnlocked()`, `unlock()`, `lock()`. One home for all `sessionStorage` access.
- `src/components/AccessCodeForm.tsx` — presentational code card. Props `{ onUnlock: () => void }`. Owns input state and the code comparison.
- `src/components/RequireAccess.tsx` — route-layout guard. Renders the form or `<Outlet />`.
- `src/components/AppBootstrap.tsx` — fires `ensureSchema()` and `flushSrsQueue()` on mount. Lives inside the gated subtree so public visitors make no Turso calls.

**New — landing data**
- `src/landing/types.ts` — `LandingStats`, `LandingLanguage`, `LandingModule`.
- `src/landing/languages.ts` — `landingLanguages: LandingLanguage[]`.
- `src/landing/modules.ts` — `landingModules: LandingModule[]`.
- `src/lib/targetLanguage.ts` — `getTargetLanguage()`, `setTargetLanguage(name)` over `localStorage`.

**New — landing UI**
- `src/pages/Landing.tsx` — composes the sections, owns selected-language state, writes the preference.
- `src/components/landing/LandingNavbar.tsx` — wordmark, anchor links, CTA to `/dashboard`.
- `src/components/landing/LandingHero.tsx` — eyebrow, headline, CTAs, current-language note.
- `src/components/landing/LanguagePicker.tsx` — presentational toggle row. Props `{ value, onChange }`.
- `src/components/landing/FeatureGrid.tsx` — the module hub grid.
- `src/components/landing/ModuleCard.tsx` — one card. Props `{ module, languageName }`.
- `src/components/landing/LandingHowItWorks.tsx` — three steps.
- `src/components/landing/LandingFooter.tsx` — closing links.

**New — tests**
- `src/lib/access.test.ts`, `src/lib/targetLanguage.test.ts`, `src/landing/languages.test.ts`
- `src/components/RequireAccess.test.tsx`
- `src/components/landing/FeatureGrid.test.tsx`, `src/components/landing/LanguagePicker.test.tsx`
- `src/pages/Landing.test.tsx`

**Modified**
- `src/App.tsx` — new route table, gate becomes a layout route, app-chrome providers move inside it.
- `src/main.tsx` — drop the eager `ensureSchema()` / `flushSrsQueue()`.
- `src/components/AccessGate.tsx` — **deleted** in Task 8.
- `src/components/Layout.tsx:7,41` — sign-out calls `lock()`.
- `src/components/Navbar.tsx:20,39` — `/` → `/dashboard`.
- `src/components/OnboardingDialog.tsx:93` — `navigate('/')` → `navigate('/dashboard')`.
- `src/pages/NotFound.tsx` — `<a href="/">` → `<Link>`.
- `src/pages/Index.tsx:37` — seed the language filter.
- `src/pages/VocabBank.tsx:42` — seed the language filter.
- `index.html` — public title/description/OG.
- `vite.config.ts:30` — PWA `start_url` → `/dashboard`.

---

### Task 1: Access storage primitives

**Files:**
- Create: `src/lib/access.ts`
- Test: `src/lib/access.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ACCESS_STORAGE_KEY: string` (`'lingovault_unlocked'`), `isUnlocked(): boolean`, `unlock(): void`, `lock(): void`. Tasks 4, 8, and the `Layout.tsx` sign-out all import from here.

- [ ] **Step 1: Write the failing test**

Create `src/lib/access.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { ACCESS_STORAGE_KEY, isUnlocked, lock, unlock } from './access'

describe('access', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('uses the key the e2e spec seeds', () => {
    expect(ACCESS_STORAGE_KEY).toBe('lingovault_unlocked')
  })

  it('starts locked', () => {
    expect(isUnlocked()).toBe(false)
  })

  it('is locked when the stored flag is anything other than "1"', () => {
    sessionStorage.setItem(ACCESS_STORAGE_KEY, 'true')
    expect(isUnlocked()).toBe(false)
  })

  it('unlocks and reports unlocked', () => {
    unlock()
    expect(isUnlocked()).toBe(true)
  })

  it('locks again', () => {
    unlock()
    lock()
    expect(isUnlocked()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/access.test.ts`
Expected: FAIL — `Failed to resolve import "./access"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/access.ts`:

```ts
/**
 * Single home for the unlock flag.
 *
 * The key name and the sessionStorage store are load bearing: e2e/add-word.spec.ts seeds
 * `sessionStorage.setItem('lingovault_unlocked', '1')` to bypass the gate in tests, so
 * neither may be renamed or moved to localStorage.
 */
export const ACCESS_STORAGE_KEY = 'lingovault_unlocked'

export const isUnlocked = (): boolean => sessionStorage.getItem(ACCESS_STORAGE_KEY) === '1'

export const unlock = (): void => {
  sessionStorage.setItem(ACCESS_STORAGE_KEY, '1')
}

export const lock = (): void => {
  sessionStorage.removeItem(ACCESS_STORAGE_KEY)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/access.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access.ts src/lib/access.test.ts
git commit -m "feat: extract access storage primitives into src/lib/access"
```

---

### Task 2: Landing manifest

**Files:**
- Create: `src/landing/types.ts`
- Create: `src/landing/languages.ts`
- Create: `src/landing/modules.ts`
- Test: `src/landing/languages.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/landing/types.ts`: `LandingStats { words: number; decks: number; lessons: number }`, `LandingLanguage { slug: string; name: string; tagline: string; highlights: string[]; stats: LandingStats }`, `LandingModule { id: string; title: string; description: string; icon: LucideIcon; to: string; cta: string }`
  - `src/landing/languages.ts`: `landingLanguages: LandingLanguage[]`
  - `src/landing/modules.ts`: `landingModules: LandingModule[]`

- [ ] **Step 1: Write the failing test**

Create `src/landing/languages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { landingLanguages } from './languages'
import { landingModules } from './modules'
import { getLangBadgeClasses, getLangDotClass } from '@/lib/langColors'

/** The only names langColors.ts can colour; anything else silently falls back to zinc. */
const COLOURED = ['Danish', 'Japanese', 'Spanish']

describe('landing manifest', () => {
  it('ships a language for every colour the app can render', () => {
    expect(landingLanguages.map((l) => l.name).sort()).toEqual([...COLOURED].sort())
  })

  it('gives every language a distinct slug', () => {
    const slugs = landingLanguages.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('fills in every field the landing page renders', () => {
    for (const language of landingLanguages) {
      expect(language.slug.trim()).not.toBe('')
      expect(language.name.trim()).not.toBe('')
      expect(language.tagline.trim()).not.toBe('')
      expect(language.highlights.length).toBeGreaterThan(0)
      for (const highlight of language.highlights) expect(highlight.trim()).not.toBe('')
      expect(Number.isFinite(language.stats.words)).toBe(true)
      expect(Number.isFinite(language.stats.decks)).toBe(true)
      expect(Number.isFinite(language.stats.lessons)).toBe(true)
    }
  })

  it('gives every language real colour rather than the fallback', () => {
    for (const language of landingLanguages) {
      expect(getLangDotClass(language.name)).not.toBe('bg-zinc-400')
      expect(getLangBadgeClasses(language.name)).not.toContain('zinc')
    }
  })

  it('routes every module at a page that exists', () => {
    const real = ['/dashboard', '/vocab', '/quiz', '/lessons', '/languages', '/video/:id']
    for (const module of landingModules) expect(real).toContain(module.to)
  })

  it('gives every module an id, a title, a description and a call to action', () => {
    expect(new Set(landingModules.map((m) => m.id)).size).toBe(landingModules.length)
    for (const module of landingModules) {
      expect(module.title.trim()).not.toBe('')
      expect(module.description.trim()).not.toBe('')
      expect(module.cta.trim()).not.toBe('')
    }
  })

  it('covers the five modules the landing page advertises', () => {
    expect(landingModules.map((m) => m.id)).toEqual([
      'vocab',
      'quizzes',
      'conjugation',
      'grammar',
      'study-rooms',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/landing/languages.test.ts`
Expected: FAIL — `Failed to resolve import "./languages"`.

- [ ] **Step 3: Write the types**

Create `src/landing/types.ts`:

```ts
import type { LucideIcon } from 'lucide-react'

export interface LandingStats {
  words: number
  decks: number
  lessons: number
}

export interface LandingLanguage {
  /** URL-safe identifier, used as a React key. */
  slug: string
  /**
   * Must be a key in src/lib/langColors.ts — that is what supplies the colour. It is also
   * the exact string written to the database `languages.name` column, so it has to match.
   */
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
  /** An in-app route. See the manifest test for the list of routes that exist. */
  to: string
  cta: string
}
```

- [ ] **Step 4: Write the language manifest**

Create `src/landing/languages.ts`:

```ts
import type { LandingLanguage } from './types'

/**
 * Curated marketing copy for the public landing page. The `stats` figures are hand
 * maintained snapshots, NOT live query results — refresh them by editing this file. The
 * database remains the source of truth for the app; a language added at runtime through
 * /languages will not appear here until it is added below.
 */
export const landingLanguages: LandingLanguage[] = [
  {
    slug: 'danish',
    name: 'Danish',
    tagline: 'Close to the ground, quick on the ear once you stop translating.',
    highlights: [
      'Vowel endings that finally stop surprising you',
      'Compound nouns broken apart as you meet them',
      'Street interviews you can follow without a transcript',
    ],
    stats: { words: 1240, decks: 18, lessons: 12 },
  },
  {
    slug: 'japanese',
    name: 'Japanese',
    tagline: 'Three scripts, one rhythm, and a dictionary that never sleeps.',
    highlights: [
      'Kanji tracked beside the kana that carry them',
      'Pitch accent marked as you hear it',
      'Keigo and register side by side',
    ],
    stats: { words: 860, decks: 11, lessons: 7 },
  },
  {
    slug: 'spanish',
    name: 'Spanish',
    tagline: 'The fastest route from listening to holding an actual conversation.',
    highlights: [
      'Subjunctive rules gathered into one page',
      'Ser and estar contrasted until it is boring',
      'Full-length dramas with notes at every turn',
    ],
    stats: { words: 1520, decks: 24, lessons: 15 },
  },
]
```

- [ ] **Step 5: Write the module manifest**

Create `src/landing/modules.ts`:

```ts
import { BookMarked, BookOpen, Film, Table2, Zap } from 'lucide-react'
import type { LandingModule } from './types'

/**
 * Every card points at a page that exists today. Conjugation and grammar deliberately
 * share /lessons: conjugation is a `table` block inside a lesson, grammar is lesson text
 * parts. They get distinct copy so the landing page can describe both honestly.
 */
export const landingModules: LandingModule[] = [
  {
    id: 'vocab',
    title: 'Vocabulary Banks',
    description:
      'Every word you meet gets a home: your own phrasing, the sentence it came from, and a spaced-repetition schedule that decides when you see it again.',
    icon: BookOpen,
    to: '/vocab',
    cta: 'Open the bank',
  },
  {
    id: 'quizzes',
    title: 'Flashcard Quizzes',
    description:
      'A drill that only shows what is actually due. Grade yourself fail, hard, good or easy and the next interval is recalculated on the spot.',
    icon: Zap,
    to: '/quiz',
    cta: 'Start drilling',
  },
  {
    id: 'conjugation',
    title: 'Verb Conjugation',
    description:
      'Conjugation tables laid out as tense columns and verb rows, kept as editable lesson blocks so new verbs slot in as a row rather than a rewrite.',
    icon: Table2,
    to: '/lessons',
    cta: 'See the tables',
  },
  {
    id: 'grammar',
    title: 'Grammar Guides',
    description:
      'The rules the tables assume, written as structured lesson parts — headings, prose and colour, sitting right beside the examples.',
    icon: BookMarked,
    to: '/lessons',
    cta: 'Read the guides',
  },
  {
    id: 'study-rooms',
    title: 'Video Study Rooms',
    description:
      'Play a lesson and work inside it: pause to screenshot, sketch over the frame, and send any word straight to the bank from the sentence you are reading.',
    icon: Film,
    to: '/dashboard',
    cta: 'Open a room',
  },
]
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/landing/languages.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/landing
git commit -m "feat: static landing page manifest for languages and modules"
```

---

### Task 3: Target language preference

**Files:**
- Create: `src/lib/targetLanguage.ts`
- Test: `src/lib/targetLanguage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getTargetLanguage(): string | null`, `setTargetLanguage(name: string): void`. `Landing.tsx` writes; `Index.tsx:37` and `VocabBank.tsx:42` read.

- [ ] **Step 1: Write the failing test**

Create `src/lib/targetLanguage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { getTargetLanguage, setTargetLanguage } from './targetLanguage'

describe('targetLanguage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is null until a language is chosen', () => {
    expect(getTargetLanguage()).toBeNull()
  })

  it('reads back what was written', () => {
    setTargetLanguage('Japanese')
    expect(getTargetLanguage()).toBe('Japanese')
  })

  it('keeps only the latest choice', () => {
    setTargetLanguage('Danish')
    setTargetLanguage('Spanish')
    expect(getTargetLanguage()).toBe('Spanish')
  })

  it('survives a fresh module read, because it is a stored preference', () => {
    setTargetLanguage('Spanish')
    // Reading the key directly proves it is in localStorage, not sessionStorage.
    expect(localStorage.getItem('lingovault_target_language')).toBe('Spanish')
    expect(sessionStorage.getItem('lingovault_target_language')).toBeNull()
  })

  it('stores the name, not the slug', () => {
    setTargetLanguage('Danish')
    expect(getTargetLanguage()).toBe('Danish')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/targetLanguage.test.ts`
Expected: FAIL — `Failed to resolve import "./targetLanguage"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/targetLanguage.ts`:

```ts
const KEY = 'lingovault_target_language'

/**
 * The language a visitor picked on the public landing page, before they ever authenticated.
 * `localStorage` rather than `sessionStorage` because this is a durable preference, not an
 * unlock flag, and it is written while the visitor is still anonymous.
 */
export const getTargetLanguage = (): string | null => localStorage.getItem(KEY)

/** Stores the database `languages.name` value, which is what the app filters on. */
export const setTargetLanguage = (name: string): void => {
  localStorage.setItem(KEY, name)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/targetLanguage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/targetLanguage.ts src/lib/targetLanguage.test.ts
git commit -m "feat: persist the language picked on the landing page"
```

---

### Task 4: Code form and route guard

**Files:**
- Create: `src/components/AccessCodeForm.tsx`
- Create: `src/components/RequireAccess.tsx`
- Modify: `src/components/AccessGate.tsx` (rewrite to delegate; it is deleted in Task 8)
- Modify: `src/components/Layout.tsx:7,41`
- Test: `src/components/RequireAccess.test.tsx`

**Interfaces:**
- Consumes: `ACCESS_STORAGE_KEY`, `isUnlocked()`, `unlock()`, `lock()` from `src/lib/access` (Task 1).
- Produces:
  - `AccessCodeForm` from `@/components/AccessCodeForm` — props `{ onUnlock: () => void }`. Calls `unlock()` itself when the code matches, then `onUnlock()`.
  - default export from `@/components/RequireAccess` — no props, renders `<AccessCodeForm>` or `<Outlet />`. Used as a `<Route element={...}>` in Task 8.

> **Note on `AccessGate`:** this task rewrites it to delegate to the new pieces so `src/App.tsx:36` keeps working untouched and every commit stays green. Task 8 deletes the file once the route table no longer references it.

- [ ] **Step 1: Write the failing test**

Create `src/components/RequireAccess.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RequireAccess from './RequireAccess'

const PRIVATE_PAGE = () => <p>secret dashboard</p>

/** Renders a guarded route so the test can tell the form and the outlet apart. */
function renderGuard(initialEntries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<RequireAccess />}>
          <Route path="/dashboard" element={<PRIVATE_PAGE />} />
          <Route path="/vocab" element={<p>secret bank</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

const codeField = () => screen.getByPlaceholderText('Access code')
const codeForm = () => codeField().closest('form') as HTMLFormElement

describe('RequireAccess', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('asks for the code when nothing is unlocked', () => {
    renderGuard()

    expect(codeField()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
    expect(screen.queryByText('secret dashboard')).toBeNull()
  })

  it('renders the route the visitor actually asked for once unlocked', () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderGuard(['/vocab'])

    expect(screen.getByText('secret bank')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Access code')).toBeNull()
  })

  it('reveals the page on the correct code without a reload', () => {
    renderGuard()

    fireEvent.change(codeField(), { target: { value: '123123123' } })
    fireEvent.submit(codeForm())

    expect(screen.getByText('secret dashboard')).toBeInTheDocument()
    expect(sessionStorage.getItem('lingovault_unlocked')).toBe('1')
  })

  it('refuses a wrong code and shows why', () => {
    renderGuard()

    fireEvent.change(codeField(), { target: { value: 'nope' } })
    fireEvent.submit(codeForm())

    expect(screen.queryByText('secret dashboard')).toBeNull()
    expect(screen.getByText(/incorrect code/i)).toBeInTheDocument()
    expect(codeField()).toHaveValue('')
  })

  it('will not submit an empty code', () => {
    renderGuard()

    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled()
  })
})
```

The form is submitted with `fireEvent.submit` rather than by clicking the button: jsdom's implicit submission on a `type="submit"` click is unreliable across versions, and `submit` exercises the same handler a real click reaches.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/RequireAccess.test.tsx`
Expected: FAIL — `Failed to resolve import "./RequireAccess"`.

- [ ] **Step 3: Write the code form**

Create `src/components/AccessCodeForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { unlock } from '@/lib/access'
import { DEFAULT_ACCESS_CODE, getAccessCode, isCustomAccessCode } from '@/lib/accessCode'

interface AccessCodeFormProps {
  /** Called after the flag is written, so the caller can render the page. */
  onUnlock: () => void
}

export const AccessCodeForm = ({ onUnlock }: AccessCodeFormProps) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (value === getAccessCode()) {
      unlock()
      onUnlock()
      return
    }
    setError(true)
    setValue('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-3xl tracking-tight text-primary">
            LingoVault
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter the access code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="Access code"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(false)
              }}
              className={error ? 'border-destructive focus-visible:ring-destructive/30' : ''}
            />
            <p className="text-xs text-muted-foreground font-mono">
              {isCustomAccessCode()
                ? 'Access code set by the owner'
                : `Demo access code: ${DEFAULT_ACCESS_CODE}`}
            </p>
            {error && (
              <p className="text-xs text-destructive font-mono">Incorrect code, try again.</p>
            )}
            <Button
              type="submit"
              disabled={!value}
              className="w-full gap-2 text-sm font-semibold"
              size="lg">
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

The original handled Enter with a manual `onKeyDown`; a real `<form onSubmit>` does it natively and keeps the button's default `type="submit"`.

- [ ] **Step 4: Write the route guard**

Create `src/components/RequireAccess.tsx`:

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { isUnlocked } from '@/lib/access'
import { AccessCodeForm } from './AccessCodeForm'

/**
 * Route-layout guard. Rendered as `<Route element={<RequireAccess />}>` so every gated
 * page is declared once, and a locked visitor who deep-links to any of them still lands
 * on the page they asked for after unlocking.
 */
const RequireAccess = () => {
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <Outlet />

  return <AccessCodeForm onUnlock={() => setUnlocked(true)} />
}

export default RequireAccess
```

- [ ] **Step 5: Rewrite AccessGate to delegate**

Replace the whole of `src/components/AccessGate.tsx`:

```tsx
import { useState, type ReactNode } from 'react'

import { isUnlocked } from '@/lib/access'
import { AccessCodeForm } from './AccessCodeForm'

/**
 * Re-exported for the existing sign-out call site. The gate itself now lives in
 * RequireAccess, which is a route-layout guard rather than a children wrapper.
 */
export { ACCESS_STORAGE_KEY } from '@/lib/access'

const AccessGate = ({ children }: { children: ReactNode }) => {
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <>{children}</>

  return <AccessCodeForm onUnlock={() => setUnlocked(true)} />
}

export default AccessGate
```

- [ ] **Step 6: Point Layout sign-out at lock()**

In `src/components/Layout.tsx`, replace line 7:

```tsx
import { ACCESS_STORAGE_KEY } from './AccessGate'
```

with:

```tsx
import { lock } from '@/lib/access'
```

and replace the `handleSignOut` body (lines 40-43):

```tsx
  const handleSignOut = useCallback(() => {
    lock()
    window.location.reload()
  }, [])
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/RequireAccess.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 8: Verify nothing else broke**

Run: `npm run lint; npx tsc -b; npx vitest run`
Expected: lint clean, no type errors, all suites pass. `src/pages/Index.test.tsx` and the rest of the suite must be unaffected because `AccessGate`'s default export still behaves the same.

- [ ] **Step 9: Commit**

```bash
git add src/components/AccessCodeForm.tsx src/components/RequireAccess.tsx src/components/AccessGate.tsx src/components/Layout.tsx src/components/RequireAccess.test.tsx
git commit -m "refactor: split the access gate into a form, a storage module and a route guard"
```

---

### Task 5: Feature hub grid

**Files:**
- Create: `src/components/landing/ModuleCard.tsx`
- Create: `src/components/landing/FeatureGrid.tsx`
- Test: `src/components/landing/FeatureGrid.test.tsx`

**Interfaces:**
- Consumes: `landingModules: LandingModule[]` from `@/landing/modules` (Task 2); `getLangBadgeClasses(name)` from `@/lib/langColors`; `LandingModule` from `@/landing/types`.
- Produces: `ModuleCard` from `@/components/landing/ModuleCard` (props `{ module: LandingModule; languageName?: string | null }`), `FeatureGrid` from `@/components/landing/FeatureGrid` (props `{ languageName?: string | null }`). `Landing.tsx` composes `FeatureGrid`.

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/FeatureGrid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { FeatureGrid } from './FeatureGrid'
import { landingModules } from '@/landing/modules'

const renderGrid = (languageName: string | null = null) =>
  render(
    <MemoryRouter>
      <FeatureGrid languageName={languageName} />
    </MemoryRouter>
  )

describe('FeatureGrid', () => {
  it('offers a card for every module', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByRole('link', { name: new RegExp(module.title, 'i') })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('link')).toHaveLength(landingModules.length)
  })

  it('sends each card to the page that backs it up', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByRole('link', { name: new RegExp(module.title, 'i') })).toHaveAttribute(
        'href',
        module.to
      )
    }
  })

  it('shows the call to action on every card', () => {
    renderGrid()

    for (const module of landingModules) {
      expect(screen.getByText(module.cta)).toBeInTheDocument()
    }
  })

  it('marks the selected language so the grid reflects the visitor context', () => {
    renderGrid('Japanese')

    expect(screen.getAllByText('Japanese')).toHaveLength(landingModules.length)
  })

  it('leaves the badge off when no language is chosen yet', () => {
    renderGrid()

    expect(screen.queryByText('Japanese')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/FeatureGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./FeatureGrid"`.

- [ ] **Step 3: Write the card**

Create `src/components/landing/ModuleCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { getLangBadgeClasses } from '@/lib/langColors'
import type { LandingModule } from '@/landing/types'

interface ModuleCardProps {
  module: LandingModule
  /** The language the visitor picked, shown as a badge. Null before they choose. */
  languageName?: string | null
}

export const ModuleCard = ({ module, languageName }: ModuleCardProps) => {
  const Icon = module.icon

  return (
    <Link
      to={module.to}
      className="group flex flex-col rounded-2xl border border-border/40 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 transition-transform duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        {languageName ? (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${getLangBadgeClasses(
              languageName
            )}`}>
            {languageName}
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{module.title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {module.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 transition-colors group-hover:text-primary">
        {module.cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
```

- [ ] **Step 4: Write the grid**

Create `src/components/landing/FeatureGrid.tsx`:

```tsx
import { landingModules } from '@/landing/modules'
import { ModuleCard } from './ModuleCard'

interface FeatureGridProps {
  languageName?: string | null
}

/** The central hub: every learning module as one card, filtered by nothing and curated by all. */
export const FeatureGrid = ({ languageName }: FeatureGridProps) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {landingModules.map((module) => (
      <ModuleCard key={module.id} module={module} languageName={languageName} />
    ))}
  </div>
)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/FeatureGrid.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/ModuleCard.tsx src/components/landing/FeatureGrid.tsx src/components/landing/FeatureGrid.test.tsx
git commit -m "feat: landing page feature hub grid"
```

---

### Task 6: Language picker

**Files:**
- Create: `src/components/landing/LanguagePicker.tsx`
- Test: `src/components/landing/LanguagePicker.test.tsx`

**Interfaces:**
- Consumes: `landingLanguages: LandingLanguage[]` from `@/landing/languages` (Task 2); `getLangDotClass(name)` from `@/lib/langColors`; `cn` from `@/lib/utils`.
- Produces: `LanguagePicker` from `@/components/landing/LanguagePicker`, props `{ value: string | null; onChange: (name: string) => void }`.

> **Deliberate refinement of the spec.** The spec says the picker calls `setTargetLanguage`. This task keeps the picker purely presentational and lets `Landing` own persistence, because persistence is a side effect the page should decide about, not a button. `LanguagePicker.test.tsx` therefore tests only display and the reported click; the `localStorage` write is asserted in `Landing.test.tsx` (Task 7). Net behaviour is identical to the spec.

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/LanguagePicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { LanguagePicker } from './LanguagePicker'
import { landingLanguages } from '@/landing/languages'

describe('LanguagePicker', () => {
  it('offers a toggle for every language', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toBeInTheDocument()
    }
  })

  it('marks the current choice as pressed', () => {
    render(<LanguagePicker value="Danish" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Danish' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Spanish' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('presets nothing when the visitor has not chosen', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
  })

  it('reports the language that was picked, by database name', () => {
    const onChange = vi.fn()
    render(<LanguagePicker value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }))

    expect(onChange).toHaveBeenCalledWith('Japanese')
  })

  it('is a labelled group for screen readers', () => {
    render(<LanguagePicker value={null} onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: /choose a language/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/LanguagePicker.test.tsx`
Expected: FAIL — `Failed to resolve import "./LanguagePicker"`.

- [ ] **Step 3: Write the picker**

Create `src/components/landing/LanguagePicker.tsx`:

```tsx
import { getLangDotClass } from '@/lib/langColors'
import { landingLanguages } from '@/landing/languages'
import { cn } from '@/lib/utils'

interface LanguagePickerProps {
  /** The database `languages.name` currently chosen, or null before a choice is made. */
  value: string | null
  onChange: (name: string) => void
}

export const LanguagePicker = ({ value, onChange }: LanguagePickerProps) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a language">
    {landingLanguages.map((language) => {
      const active = language.name === value

      return (
        <button
          key={language.slug}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(language.name)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            active
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/40 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
          )}>
          <span className={cn('h-2 w-2 rounded-full', getLangDotClass(language.name))} />
          {language.name}
        </button>
      )
    })}
  </div>
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/LanguagePicker.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/LanguagePicker.tsx src/components/landing/LanguagePicker.test.tsx
git commit -m "feat: language picker for the landing page"
```

---

### Task 7: Landing page

**Files:**
- Create: `src/components/landing/LandingNavbar.tsx`
- Create: `src/components/landing/LandingHero.tsx`
- Create: `src/components/landing/LandingHowItWorks.tsx`
- Create: `src/components/landing/LandingFooter.tsx`
- Create: `src/pages/Landing.tsx`
- Modify: `index.html:7-24`
- Test: `src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: `landingLanguages`, `LandingLanguage` from `@/landing` (Task 2); `getTargetLanguage`, `setTargetLanguage` from `@/lib/targetLanguage` (Task 3); `FeatureGrid` (Task 5); `LanguagePicker` (Task 6).
- Produces: default export from `@/pages/Landing`. Wired to `/` in Task 8.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Landing.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Landing from './Landing'
import { landingLanguages } from '@/landing/languages'
import { landingModules } from '@/landing/modules'

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )

const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('leads with a single headline and one clear way in', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /enter the vault/i })).toHaveAttribute(
      'href',
      '/dashboard'
    )
  })

  it('lists every module as a way into the app', () => {
    renderLanding()

    for (const module of landingModules) {
      expect(screen.getByRole('link', { name: new RegExp(module.title, 'i') })).toHaveAttribute(
        'href',
        module.to
      )
    }
  })

  it('offers every language before anything is chosen', () => {
    renderLanding()

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toBeInTheDocument()
    }
  })

  it('remembers the language so the app can open on it', () => {
    renderLanding()

    pick('Spanish')

    expect(localStorage.getItem('lingovault_target_language')).toBe('Spanish')
    expect(screen.getByRole('button', { name: 'Spanish' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reveals the chosen language detail only after a choice is made', () => {
    renderLanding()

    expect(screen.queryByText(new RegExp(landingLanguages[0].tagline))).toBeNull()

    pick('Danish')

    expect(screen.getByText(new RegExp(landingLanguages[0].tagline))).toBeInTheDocument()
    expect(screen.getByText('Words banked')).toBeInTheDocument()
    for (const highlight of landingLanguages[0].highlights) {
      expect(screen.getByText(highlight)).toBeInTheDocument()
    }
  })

  it('badges every module card with the chosen language', () => {
    renderLanding()

    pick('Danish')

    // One picker button plus one badge per card.
    expect(screen.getAllByText('Danish')).toHaveLength(landingModules.length + 1)
  })

  it('reopens on the language that was chosen before', () => {
    localStorage.setItem('lingovault_target_language', 'Japanese')
    renderLanding()

    expect(screen.getByRole('button', { name: 'Japanese' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText(new RegExp(landingLanguages[1].tagline))).toBeInTheDocument()
  })

  it('ignores a stored language the manifest does not know about', () => {
    localStorage.setItem('lingovault_target_language', 'Klingon')
    renderLanding()

    for (const language of landingLanguages) {
      expect(screen.getByRole('button', { name: language.name })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    }
    expect(screen.queryByText(/Klingon/)).toBeNull()
  })

  it('paints its content immediately, with no loading state', () => {
    renderLanding()

    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — `Failed to resolve import "./Landing"`.

- [ ] **Step 3: Write the navbar**

Create `src/components/landing/LandingNavbar.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'

import { Button } from '@/components/ui/button'

const ANCHORS = [
  { href: '#languages', label: 'Languages' },
  { href: '#modules', label: 'Modules' },
  { href: '#how', label: 'How it works' },
]

export const LandingNavbar = () => (
  <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="font-display text-xl font-semibold tracking-tight text-primary">
        LingoVault
      </Link>
      <div className="hidden items-center gap-1 md:flex">
        {ANCHORS.map((anchor) => (
          <a
            key={anchor.href}
            href={anchor.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            {anchor.label}
          </a>
        ))}
      </div>
      <Button asChild size="sm" className="gap-2 font-semibold">
        <Link to="/dashboard">
          <LockKeyhole className="h-3.5 w-3.5" />
          Enter the vault
        </Link>
      </Button>
    </div>
  </nav>
)
```

- [ ] **Step 4: Write the hero**

Create `src/components/landing/LandingHero.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getLangBadgeClasses } from '@/lib/langColors'
import type { LandingLanguage } from '@/landing/types'

interface LandingHeroProps {
  /** The language the visitor already chose, or null on a first visit. */
  language: LandingLanguage | null
}

export const LandingHero = ({ language }: LandingHeroProps) => (
  <section className="flex flex-col items-center py-20 text-center sm:py-28">
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
      Danish · Japanese · Spanish
    </p>
    <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
      A quiet place to <span className="text-primary">actually learn</span> a language
    </h1>
    <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
      Watch a lesson, pull the words out as you meet them, and let spaced repetition decide
      what you see next. Everything you collect lives in one vault.
    </p>
    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg" className="gap-2 font-semibold">
        <Link to="/dashboard">
          Enter the vault
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <a href="#modules">Browse the modules</a>
      </Button>
    </div>
    {language ? (
      <p className="mt-8 text-sm text-muted-foreground">
        You were working on{' '}
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${getLangBadgeClasses(
            language.name
          )}`}>
          {language.name}
        </span>{' '}
        — {language.tagline}
      </p>
    ) : null}
  </section>
)
```

- [ ] **Step 5: Write the how-it-works section**

Create `src/components/landing/LandingHowItWorks.tsx`:

```tsx
import { KeyRound, Library, TrendingUp } from 'lucide-react'

const STEPS = [
  {
    icon: Library,
    title: 'Choose a language',
    body: 'Pick it here and the vault opens already filtered to it. Your media, your words, your drills — nothing else in the way.',
  },
  {
    icon: KeyRound,
    title: 'Unlock the vault',
    body: 'Your access code is the only thing between the landing page and your library. Nothing is loaded from the database until it is entered.',
  },
  {
    icon: TrendingUp,
    title: 'Let the schedule run',
    body: 'Every word you save gets a review date. The quiz only ever shows what is due, so a session is never a waste of ten minutes.',
  },
]

export const LandingHowItWorks = () => (
  <section id="how" className="scroll-mt-20 border-t border-border/40 py-16">
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
      How it works
    </p>
    <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
      Three steps, then you are studying
    </h2>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, index) => (
        <div
          key={title}
          className="rounded-2xl border border-border/40 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/5">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Step {index + 1}
            </span>
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  </section>
)
```

- [ ] **Step 6: Write the footer**

Create `src/components/landing/LandingFooter.tsx`:

```tsx
import { Link } from 'react-router-dom'

import { landingModules } from '@/landing/modules'

export const LandingFooter = () => (
  <footer className="border-t border-border/40">
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg font-semibold tracking-tight text-primary">
            LingoVault
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A single place for the words, lessons and drills you collect while learning a
            language.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Modules
          </p>
          <ul className="mt-3 space-y-2">
            {landingModules.map((module) => (
              <li key={module.id}>
                <Link
                  to={module.to}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {module.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-10 border-t border-border/40 pt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
        LingoVault
      </p>
    </div>
  </footer>
)
```

- [ ] **Step 7: Compose the page**

Create `src/pages/Landing.tsx`:

```tsx
import { useState } from 'react'
import { Check } from 'lucide-react'

import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { LanguagePicker } from '@/components/landing/LanguagePicker'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks'
import { LandingNavbar } from '@/components/landing/LandingNavbar'
import { landingLanguages } from '@/landing/languages'
import { getTargetLanguage, setTargetLanguage } from '@/lib/targetLanguage'

const STAT_LABELS: { key: 'words' | 'decks' | 'lessons'; label: string }[] = [
  { key: 'words', label: 'Words banked' },
  { key: 'decks', label: 'Decks' },
  { key: 'lessons', label: 'Lessons' },
]

/**
 * The public face of the app. Reads nothing but the static manifest, so it paints without
 * a database call. The language choice is persisted here, before the visitor authenticates,
 * so the app can open pre-filtered.
 */
const Landing = () => {
  const [language, setLanguage] = useState<string | null>(() => getTargetLanguage())

  const handleLanguage = (name: string) => {
    setTargetLanguage(name)
    setLanguage(name)
  }

  // A stored name the manifest does not carry is ignored rather than rendered.
  const active = landingLanguages.find((entry) => entry.name === language) ?? null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNavbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingHero language={active} />

          <section id="languages" className="scroll-mt-20 border-t border-border/40 py-16">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Pick your language
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your choice follows you in
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose a language here and the vault opens already filtered to it — your media,
              your vocabulary and your drills, with nothing else in the way.
            </p>

            <div className="mt-8">
              <LanguagePicker value={language} onChange={handleLanguage} />
            </div>

            {active ? (
              <div className="mt-10">
                <div className="grid gap-4 sm:grid-cols-3">
                  {STAT_LABELS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-border/40 bg-card p-5">
                      <p className="font-display text-3xl font-semibold tracking-tight text-primary">
                        {active.stats[key].toLocaleString()}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <ul className="mt-6 space-y-3">
                  {active.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section id="modules" className="scroll-mt-20 border-t border-border/40 py-16">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Everything inside
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Five ways in, one vault
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Jump straight into whichever part of learning you came for.
            </p>
            <div className="mt-10">
              <FeatureGrid languageName={active?.name ?? null} />
            </div>
          </section>

          <LandingHowItWorks />
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}

export default Landing
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 9: Update the document metadata**

In `index.html`, replace lines 7-24 with:

```html
    <title>LingoVault — Learn a language in one vault</title>
    <meta name="description" content="LingoVault collects the words, lessons and drills you pick up while learning Danish, Japanese or Spanish. Vocabulary banks with spaced repetition, conjugation tables, grammar guides, and study rooms for video and text." />
    <meta name="author" content="Lovable" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="LingoVault" />
    <meta property="og:title" content="LingoVault — Learn a language in one vault" />
    <meta property="og:description" content="Vocabulary banks, conjugation tables, grammar guides and study rooms for Danish, Japanese and Spanish — with spaced repetition deciding what you see next." />
    <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9a8f4bf0-cfe9-42d0-91eb-7138a9f4a858" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@Lovable" />
    <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9a8f4bf0-cfe9-42d0-91eb-7138a9f4a858" />
    <meta name="twitter:title" content="LingoVault — Learn a language in one vault" />
    <meta name="twitter:description" content="Vocabulary banks, conjugation tables, grammar guides and study rooms for Danish, Japanese and Spanish — with spaced repetition deciding what you see next." />
```

Keep the existing `og:image` and `twitter:image` URLs — they are already live assets and were not part of this change. The two `TODO` comments in that block are removed because the titles are now set.

- [ ] **Step 10: Verify**

Run: `npm run lint; npx tsc -b; npx vitest run`
Expected: lint clean, no type errors, all suites pass.

- [ ] **Step 11: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx src/components/landing index.html
git commit -m "feat: public landing page with hero, language picker and module hub"
```

---

### Task 8: Route restructure

**Files:**
- Create: `src/components/AppBootstrap.tsx`
- Modify: `src/App.tsx` (full rewrite)
- Modify: `src/main.tsx`
- Delete: `src/components/AccessGate.tsx`
- Modify: `src/components/Navbar.tsx:20,39`
- Modify: `src/components/OnboardingDialog.tsx:93`
- Modify: `src/pages/NotFound.tsx`
- Modify: `vite.config.ts:30`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `RequireAccess` from `@/components/RequireAccess` (Task 4); `Landing` from `@/pages/Landing` (Task 7).
- Produces: the final route table — `/` public, `/dashboard` `/vocab` `/quiz` `/lessons` `/languages` `/video/:id` gated, `*` public.

- [ ] **Step 1: Write the failing test**

Create `src/App.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import App from './App'
import { landingModules } from '@/landing/modules'

vi.mock('@/integrations/turso/db', () => ({
  ensureSchema: vi.fn().mockResolvedValue(undefined),
  flushSrsQueue: vi.fn(),
  videosDb: { list: vi.fn().mockResolvedValue([]), insert: vi.fn(), remove: vi.fn() },
  vocabularyDb: { list: vi.fn().mockResolvedValue([]) },
  languagesDb: { list: vi.fn().mockResolvedValue(['Danish']) },
  lessonsDb: { list: vi.fn().mockResolvedValue([]) },
  notesDb: { listByVideo: vi.fn().mockResolvedValue([]) },
  screenshotsDb: { listByVideo: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}))

/** Renders the whole app at a real browser path, since App owns a BrowserRouter. */
function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

const codeField = () => screen.getByPlaceholderText('Access code')
const codeForm = () => codeField().closest('form') as HTMLFormElement

describe('App routing', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    // The onboarding tour force-navigates to /dashboard when open. Mark it done so these
    // tests exercise routing rather than the tour.
    localStorage.setItem('lingovault_onboarded', '1')
  })

  it('shows the landing page to an anonymous visitor', async () => {
    renderAt('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /actually learn/i })
    ).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Access code')).toBeNull()
  })

  it('asks for the code on a deep link into the app', async () => {
    renderAt('/vocab')

    expect(await screen.findByPlaceholderText('Access code')).toBeInTheDocument()
  })

  it('asks for the code on every gated route', async () => {
    for (const path of ['/dashboard', '/quiz', '/lessons', '/languages', '/video/abc']) {
      const view = renderAt(path)
      expect(await screen.findByPlaceholderText('Access code')).toBeInTheDocument()
      view.unmount()
    }
  })

  it('lands the visitor on the route they asked for once unlocked', async () => {
    renderAt('/vocab')

    fireEvent.change(await screen.findByPlaceholderText('Access code'), {
      target: { value: '123123123' },
    })
    fireEvent.submit(codeForm())

    expect(await screen.findByRole('heading', { name: 'Vocab Bank' })).toBeInTheDocument()
  })

  it('serves the dashboard from /dashboard, not from the root', async () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('never serves the dashboard at the root', async () => {
    sessionStorage.setItem('lingovault_unlocked', '1')
    renderAt('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: /actually learn/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull()
  })

  it('keeps every module card pointing at a real in-app route', async () => {
    renderAt('/')

    for (const module of landingModules) {
      expect(
        await screen.findByRole('link', { name: new RegExp(module.title, 'i') })
      ).toHaveAttribute('href', module.to)
    }
  })
})
```

Two details that make this test work and are easy to get wrong:

- The test mocks `@/integrations/turso/db`, because `AppBootstrap` fires `ensureSchema()` inside the gate and the real client would try to reach the network in jsdom.
- It sets `localStorage['lingovault_onboarded'] = '1'`. `App` opens the onboarding tour on a first visit, and the tour's effect force-navigates to `/dashboard` — which would silently pull the test off the landing page. The tour is a pre-existing behaviour, not something this change introduces; marking it done isolates the routing assertion.

> **Known behaviour worth knowing:** because the tour is opened before the gate is passed, a first-time visitor who deep-links to a gated page and unlocks will be pulled to `/dashboard` by the tour. That is pre-existing and left as-is. It does not affect the landing page, because the tour is mounted inside the gated subtree and never mounts at `/`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `/` renders the gate instead of the landing page, so no `h1` matching `/actually learn/i` exists.

- [ ] **Step 3: Add the bootstrap component**

Create `src/components/AppBootstrap.tsx`:

```tsx
import { useEffect } from 'react'

import { ensureSchema, flushSrsQueue } from '@/integrations/turso/db'

/**
 * Creates the schema and drains the queued spaced-repetition writes. Mounted only inside
 * the access gate, so a visitor sitting on the public landing page never talks to the
 * database.
 */
export const AppBootstrap = () => {
  useEffect(() => {
    ensureSchema().catch((e) => {
      console.error('Failed to initialize database schema:', e)
    })
    flushSrsQueue()
  }, [])

  return null
}
```

- [ ] **Step 4: Rewrite the route table**

Replace the whole of `src/App.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Toaster as Sonner } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import AppBootstrap from '@/components/AppBootstrap'
import ErrorBoundary from '@/components/ErrorBoundary'
import OnboardingDialog from '@/components/OnboardingDialog'
import RequireAccess from '@/components/RequireAccess'
import SettingsDialogProvider from '@/components/SettingsDialogProvider'
import { isOnboardingDone } from '@/lib/onboarding'

const Landing = lazy(() => import('./pages/Landing'))
const Index = lazy(() => import('./pages/Index'))
const StudyRoom = lazy(() => import('./pages/StudyRoom'))
const VocabBank = lazy(() => import('./pages/VocabBank'))
const FlashcardQuiz = lazy(() => import('./pages/FlashcardQuiz'))
const Languages = lazy(() => import('./pages/Languages'))
const LessonsPage = lazy(() => import('./pages/LessonsPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

const App = () => {
  const [onboardingOpen, setOnboardingOpen] = useState(() => !isOnboardingDone())

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<RequireAccess />}>
                  <Route
                    element={
                      <>
                        <AppBootstrap />
                        <SettingsDialogProvider>
                          <OnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
                        </SettingsDialogProvider>
                      </>
                    }>
                    <Route path="/dashboard" element={<Index />} />
                    <Route path="/vocab" element={<VocabBank />} />
                    <Route path="/quiz" element={<FlashcardQuiz />} />
                    <Route path="/lessons" element={<LessonsPage />} />
                    <Route path="/languages" element={<Languages />} />
                    <Route path="/video/:id" element={<StudyRoom />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
```

Two things moved relative to the original and both are deliberate:

- `ErrorBoundary` now sits **outside** `<BrowserRouter>`. It renders a fallback on a crash and previously used no router hooks, so it is unaffected; wrapping it from outside means a routing error is still caught.
- The settings provider and onboarding tour are nested inside a **second** layout route under `RequireAccess`, so they mount only when unlocked. The inner route has no `path`, which makes it a pathless layout route that always matches and renders its `element` as a wrapper.

- [ ] **Step 5: Strip the eager database calls from main.tsx**

Replace the whole of `src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// The database is initialised by <AppBootstrap />, which only mounts once a visitor has
// entered the access code, so the public landing page never talks to Turso.
createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 6: Delete the old gate**

Run: `git rm src/components/AccessGate.tsx`

`AccessGate` is no longer imported anywhere — `Layout.tsx` was switched to `lock()` in Task 4.

- [ ] **Step 7: Repoint the app navbar**

In `src/components/Navbar.tsx`, replace line 20:

```tsx
  { to: "/", label: "Dashboard", icon: Home, tour: "nav-dashboard" },
```

with:

```tsx
  { to: "/dashboard", label: "Dashboard", icon: Home, tour: "nav-dashboard" },
```

and replace line 39:

```tsx
            <Link to="/" className="font-display text-xl font-semibold tracking-tight text-primary shrink-0">
```

with:

```tsx
            <Link to="/dashboard" className="font-display text-xl font-semibold tracking-tight text-primary shrink-0">
```

- [ ] **Step 8: Repoint the onboarding tour**

In `src/components/OnboardingDialog.tsx`, replace line 93:

```tsx
    if (open && location.pathname !== '/') navigate('/')
```

with:

```tsx
    if (open && location.pathname !== '/dashboard') navigate('/dashboard')
```

- [ ] **Step 9: Fix the 404 link**

In `src/pages/NotFound.tsx`, replace line 1:

```tsx
import { useLocation } from "react-router-dom";
```

with:

```tsx
import { Link, useLocation } from "react-router-dom";
```

and replace lines 16-18:

```tsx
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
```

with:

```tsx
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </Link>
```

- [ ] **Step 10: Point the installed app at the app, not the pitch**

In `vite.config.ts`, replace line 30:

```ts
        start_url: "/",
```

with:

```ts
        start_url: "/dashboard",
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS, 8 tests. If a heading assertion fails, the fix is in the test's expected string — the page headings `Dashboard` (`src/pages/Index.tsx:127`) and `Vocab Bank` (`src/pages/VocabBank.tsx:221`) are correct and must not be edited.

- [ ] **Step 12: Verify nothing else broke**

Run: `npm run lint; npx tsc -b; npx vitest run`
Expected: lint clean, no type errors, all suites pass.

- [ ] **Step 13: Build**

Run: `npm run build`
Expected: the build completes. `scripts/copy-vercel.mjs` runs as `postbuild`.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: make / a public landing page and gate the app behind a layout route"
```

---

### Task 9: Carry the language into the app

**Files:**
- Modify: `src/pages/Index.tsx:37`
- Modify: `src/pages/VocabBank.tsx:42`
- Test: `src/pages/Index.test.tsx` (add cases)
- Test: `src/pages/VocabBank.test.tsx` (add cases)

**Interfaces:**
- Consumes: `getTargetLanguage(): string | null` from `@/lib/targetLanguage` (Task 3).
- Produces: no new exports. Both pages seed their existing language filter from the stored preference on mount.

- [ ] **Step 1: Write the failing tests**

`src/pages/Index.test.tsx` already mocks `@/integrations/turso/db` and exports a
`renderDashboard()` helper (line 26) that clears nothing. Append this block at the end of
the file, after the existing `describe` closes:

```tsx
describe('Index language filter', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(videosDb.list).mockResolvedValue([])
  })

  it('lists every language when nothing was chosen on the landing page', async () => {
    renderDashboard()

    await waitFor(() => expect(videosDb.list).toHaveBeenCalledWith(undefined))
  })

  it('opens filtered to the language that was chosen on the landing page', async () => {
    localStorage.setItem('lingovault_target_language', 'Japanese')

    renderDashboard()

    await waitFor(() => expect(videosDb.list).toHaveBeenCalledWith('Japanese'))
  })
})
```

`src/pages/VocabBank.test.tsx` already has a `renderPage(words)` helper (line 53) and a
`vi.mocked(vocabularyDb.list)` it configures. Append at the end of the file:

```tsx
describe('VocabBank language filter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lists every language when nothing was chosen on the landing page', async () => {
    renderPage([])

    await waitFor(() => expect(vocabularyDb.list).toHaveBeenCalledWith(undefined))
  })

  it('opens filtered to the language that was chosen on the landing page', async () => {
    localStorage.setItem('lingovault_target_language', 'Danish')

    renderPage([])

    await waitFor(() => expect(vocabularyDb.list).toHaveBeenCalledWith('Danish'))
  })
})
```

Both files already import `beforeEach`, `describe`, `expect`, `it`, `vi`, `fireEvent`,
`render`, `screen` and `waitFor`, so no import changes are needed in either.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/Index.test.tsx src/pages/VocabBank.test.tsx`
Expected: FAIL — the filters initialise to `'all'`, so the mocks are called with `undefined`.

- [ ] **Step 3: Seed the dashboard filter**

In `src/pages/Index.tsx`, add the import next to the other `@/lib` imports:

```tsx
import { getTargetLanguage } from '@/lib/targetLanguage'
```

and replace line 37:

```tsx
  const [filter, setFilter] = useState<string>('all')
```

with:

```tsx
  const [filter, setFilter] = useState<string>(() => getTargetLanguage() ?? 'all')
```

- [ ] **Step 4: Seed the vocab bank filter**

In `src/pages/VocabBank.tsx`, add the import:

```tsx
import { getTargetLanguage } from "@/lib/targetLanguage";
```

and replace line 42:

```tsx
  const [langFilter, setLangFilter] = useState<string>("all");
```

with:

```tsx
  const [langFilter, setLangFilter] = useState<string>(() => getTargetLanguage() ?? "all");
```

The lazy initializer is required. A plain `getTargetLanguage() ?? 'all'` argument would be evaluated on every render and would reset the filter whenever the user changed it in-app.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/Index.test.tsx src/pages/VocabBank.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify nothing else broke**

Run: `npm run lint; npx tsc -b; npx vitest run`
Expected: lint clean, no type errors, all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Index.tsx src/pages/VocabBank.tsx src/pages/Index.test.tsx src/pages/VocabBank.test.tsx
git commit -m "feat: open the dashboard and vocab bank pre-filtered to the chosen language"
```

---

### Task 10: End-to-end verification

**Files:** none. This task changes no code; it proves the earlier tasks work together.

**Interfaces:**
- Consumes: everything built in Tasks 1-9.
- Produces: no new exports.

- [ ] **Step 1: Run the full gate**

Run: `npm run lint; npx tsc -b; npx vitest run; npm run build`
Expected: lint clean, no type errors, every suite green, build completes.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Vite listening on port 8080.

- [ ] **Step 3: Walk the public path by hand**

Open `http://localhost:8080/` in a browser with a clean profile. Confirm, in order:

1. The landing page paints with no code prompt and no network request to the Turso host.
2. Exactly one `<h1>`, the hero headline.
3. Clicking **Danish** sets the language, shows the stats and highlights, and puts a `Danish` badge on all five module cards.
4. **Reload.** Danish is still selected — it came from `localStorage`.
5. Click **Enter the vault** → the code form appears. It is a *different* screen, not the dashboard.
6. Entering the demo code `123123123` lands on `/dashboard` with the media library filtered to Danish.

- [ ] **Step 4: Walk the gated path by hand**

Confirm each of `/vocab`, `/quiz`, `/lessons`, `/languages` shows the code form when locked, and renders once unlocked. Confirm `/nonexistent` renders the 404 with a working **Return to Home** link that routes to the landing page without a full page load.

- [ ] **Step 5: Run the e2e spec against the real database**

Run: `npx playwright test --config=playwright.e2e.config.ts`
Expected: PASS. This is the check that matters most for the refactor — the spec seeds `sessionStorage['lingovault_unlocked']` and must still get through the new layout route. It needs `VITE_TURSO_DATABASE_URL` and `VITE_TURSO_AUTH_TOKEN` in `.env`, which the spec reads directly.

If it fails on the gate, the cause is the storage key: confirm `src/lib/access.ts` still exports `'lingovault_unlocked'` and still uses `sessionStorage`.

- [ ] **Step 6: Confirm the database is untouched by a public visit**

Open DevTools → Network, filter to non-asset requests, and reload `/`. Confirm zero requests to the Turso host. Then enter the code and confirm the requests appear. This is the whole point of moving `ensureSchema()` into `AppBootstrap`.

- [ ] **Step 7: Commit the verification note**

```bash
git commit --allow-empty -m "chore: verify public landing page and gated app routing end to end"
```

Only if a fix was needed during Steps 3-6; otherwise skip this step and report the results.
