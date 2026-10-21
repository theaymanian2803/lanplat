# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a single self-directed adult language learner (the owner) studying Danish, Spanish, French, Swedish and Japanese in focused solo sessions on a laptop or phone. They are the only current user; public use is a later, separate concern. A session moves between watching native video, reading public-domain books, translating words, and drilling vocabulary.

## Product Purpose

LingoVault is a private study vault that turns real content into retained vocabulary. It exists so the learner stops scattering work across a video site, a notes app, a dictionary, a flashcard app and a book reader. Success is a repeatable loop completed without leaving the app: encounter a word in video or a book → translate it → save it with context → review it until it sticks.

## Positioning

The shared-context loop: a saved word can originate from a timestamped video moment or a book selection, carries where it came from, and returns in spaced-repetition review. One private, local-first vault rather than a course catalog, social network, or single-purpose tool.

## Operating Context

- Solo study sessions on a laptop, with phone as a secondary surface.
- Content sources: YouTube videos with captions, Project Gutenberg books (French, Spanish, Swedish, Danish), and free-text translation.
- The learner works across more than one target language and switches without losing place.
- Data lives in a free Turso (libSQL) database; the app is reached through a private access code.
- Existing workflows: watch with A–B loop, capture screenshots and timestamped notes, save words, drill SRS flashcards, export vocabulary.

## Capabilities and Constraints

Confirmed:

- Study Room: YouTube playback, A–B loop, speed/caption controls, drawing overlay, timestamped notes and screenshots.
- Vocab Bank: per-language words with translation and optional context note; search/filter; export.
- Flashcard Quiz: spaced-repetition review.
- Translate: live translation across English, Danish, Spanish, Japanese, French, Swedish; one-click handoff to the vocab form.
- Books: static catalogues for French, Spanish, Swedish and Danish, five books per request with load-more; selecting text in the reader hands the word to the vocab form with the book's language.
- Languages: managed target-language list stored in the database.
- Access gate: client-side code; not a security boundary.
- Stack is fixed: React 18, Vite 5, TypeScript, Tailwind, shadcn/Radix, TanStack Query, Turso, react-router.
- No authentication backend; single-owner use.

Undecided:

- Whether public multi-user support will ever be built.
- Visual world, palette, typography and page concepts, deliberately deferred to the redesign.

## Brand Commitments

- Name: LingoVault.
- Voice: direct, practical, quietly premium; no hype or gamified nagging.
- No logo system, mascot, or binding color/type identity exists yet.

## Evidence on Hand

- Working app at languageplatform.unccode.site and this repository.
- 32 static book catalogue pages under `public/books`.
- No testimonials, usage benchmarks, customer logos, or pricing evidence exists; future work must not fabricate them.

## Product Principles

1. One loop, one place: every surface feeds or consumes the same saved-word loop.
2. Context is the product: a word is worth more with its source, sentence and timestamp than as a bare translation pair.
3. Calm over gamified: no streak guilt, confetti or noisy dashboards; respect the learner's attention.
4. Fast to the next action: the primary action on every screen is reachable in one scan.
5. Private by default: the owner's data and study history are not public artifacts.

## Accessibility & Inclusion

- Keyboard-operable navigation and dialogs with visible focus.
- Comfortable long-form reading in the book reader: line length, contrast and type size.
- No formal standard committed. Working assumption to confirm: WCAG 2.2 AA.
