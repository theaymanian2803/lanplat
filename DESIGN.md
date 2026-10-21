---
name: LingoVault
description: A private study carrel for turning real content into retained vocabulary.
colors:
  desk: "#191b16"
  panel: "#20241d"
  panel-raised: "#262b22"
  enamel: "#e9e2d1"
  ink: "#1b1d16"
  signal: "#d4552b"
  signal-deep: "#b8441f"
  tape: "#2e6b63"
  olive: "#7a8f4f"
  amber: "#d19a2a"
  plum: "#8a5a7a"
  overdue: "#b83226"
  muted: "#9a9d86"
  border: "#343a2d"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Courier Prime, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.2em"
rounded:
  xs: "2px"
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.signal-deep}"
  panel-enamel:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  nav-rail:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.enamel}"
    width: "224px"
  review-tape:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.enamel}"
    height: "96px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: LingoVault

## Overview

**Creative North Star: "The Study Carrel"**

The app is a working language-lab carrel: a graphite desk with enamel panels, mechanical counters and a tape that shows when every word comes back. It replaces the category's greeting-plus-stat-tiles dashboard and its card soup. The world appears through four contributions only — type, palette, density, and one signature move — while navigation, controls and layout stay familiar web patterns.

The mood is a desk lamp at night, not a game. Nothing celebrates, nags or confettis. Density is high where the learner scans (the tape, the vocabulary table), and quiet where they read (the next word, the book page). Enamel means "act or read here"; graphite means "media and background".

**Key Characteristics:**
- Graphite ground with warm enamel work panels.
- Signal orange reserved for the primary action and due state.
- One dense data object per viewport, ruled by hairlines.
- Archivo for every voice; Courier Prime only for counters and machine labels.
- 2–4px corners, no decorative shadows.

## Colors

A warm workshop palette: graphite and olive grounds, bone enamel panels, one hot signal, and language inks that carry identity.

### Primary
- **Signal Orange** (#d4552b): the primary button, the NOW playhead, due emphasis and active navigation. Never used as a large field.
- **Deep Signal** (#b8441f): hover and pressed state for the primary action.

### Secondary
- **Tape Teal** (#2e6b63): French language ink and the books shelf block.
- **Olive** (#7a8f4f): Swedish language ink and muted state ticks.
- **Amber** (#d19a2a): Spanish language ink and caution.
- **Plum** (#8a5a7a): Japanese language ink.

### Neutral
- **Graphite Desk** (#191b16): page ground.
- **Panel Graphite** (#20241d): navigation rail, media bays, tape strip.
- **Enamel Bone** (#e9e2d1): work panels that carry reading or action.
- **Ink** (#1b1d16): type on enamel.
- **Muted Sage** (#9a9d86): secondary type on graphite.
- **Hairline** (#343a2d): the only separation device.
- **Overdue Red** (#b83226): past-due ticks and destructive confirmation.

### Named Rules
**The Enamel Rule.** Enamel is a promise of work: if a surface is bone-coloured, the learner can read or act on it. Graphite never carries body copy.

**The Signal Rule.** Signal orange marks exactly one primary action per viewport; everything else is outline, ghost or ink.

## Typography

**Display Font:** Archivo (with ui-sans-serif, system-ui)
**Body Font:** Archivo (same family, 400–500)
**Label/Mono Font:** Courier Prime (with ui-monospace)

**Character:** One industrial grotesque does all speaking; a typewriter mono counts. The pairing reads as equipment labels on an enamel panel, not as editorial serif.

### Hierarchy
- **Display** (800, `clamp(2rem, 4vw, 3.4rem)`, 0.95–1.0): dashboard greeting, the next word, quiz word, book titles.
- **Headline** (800, 30–34px, 1.05): page titles.
- **Title** (700, 18–20px, 1.25): card and row titles.
- **Body** (400, 15–17px, 1.6): prose and descriptions; reading measure 65–75ch.
- **Label** (400, 10px, 0.2em uppercase, mono): counters, section labels, timestamps.

### Named Rules
**The One Voice Rule.** Archivo speaks; Courier Prime only measures. Mono is never used for prose or to look technical.

## Layout

A fixed 224px rail on desktop, with the work surface filling the rest at a 1500px cap. On mobile the rail becomes a 56px top bar plus a left sheet. Content uses a 4/8/12/16/24/32 spacing rhythm, always more space above a heading than below it. The dashboard's first viewport is: date and greeting, the full-width review tape, then a 1.45/0.85 split of source bays and the next-up column. The library sits below the fold as a dense hairline-separated list, not cards.

## Elevation & Depth

Flat by construction. There are no shadows; depth comes from tonal steps (desk → panel → enamel), 1px hairline seams, and the tape's inset black strip. Elevation is never used to imply interaction. Destructive actions are isolated by space and a vertical hairline, not by a shadow.

**The Hairline Rule.** If two surfaces need separating, use a 1px border or a tonal step; a shadow is a costume from another world.

## Shapes

Corners are near-square: 2px on ticks and chips, 4px on panels, buttons and inputs. Nothing is pill-shaped except status dots. Borders are 1px and always the hairline colour. The recurring silhouettes are the horizontal tape, the punched tick, and the rectangular equipment label.

## Components

### Buttons
- **Shape:** 4px radius, 1px border or filled.
- **Primary:** signal orange field with ink text, 12px 20px padding, 700 weight. One per viewport.
- **Hover / Focus:** deep signal on hover; a 2px signal outline with 2px offset on focus-visible.
- **Secondary / Ghost:** transparent with hairline border and enamel/cream text; ghost rows dim to muted and brighten to cream.

### Chips
- **Style:** hairline border, transparent field, 2px radius, 12px text with a 6px language dot.
- **State:** selected chips take a signal border and a 15% signal wash; counts sit in mono.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** panel graphite for media and lists; enamel bone for work panels.
- **Shadow Strategy:** none.
- **Border:** 1px hairline; no border under a shadow.
- **Internal Padding:** 16px standard, 20px for primary panels.

### Inputs / Fields
- **Style:** 1px hairline, panel graphite or transparent on enamel, 4px radius, 8px 12px padding.
- **Focus:** 2px signal ring; caret signal.
- **Error / Disabled:** overdue red text and border; disabled at 50% without changing hue.

### Navigation
- **Style:** 224px olive-graphite rail, grouped labels in Courier Prime, 14px Archivo items.
- **Default / Hover / Active:** muted sage → cream on hover → signal orange field with ink text when active.
- **Mobile:** a 56px top bar with the wordmark, settings and a menu sheet; the same groups inside.

### Review Tape (signature)
The dashboard's single dense object: a 96px graphite strip inside an enamel panel. Every saved word is a 3px tick whose horizontal position is its real review time, whose colour is its language, whose height is mastery, and whose opacity drops when it is still in the future. A signal playhead marks NOW; a Courier counter reports due, overdue and later. It is the one place where time becomes length.

## Do's and Don'ts

### Do:
- **Do** keep the review tape as the first viewport's dense object; one plot owns the field.
- **Do** use enamel for surfaces the learner reads or acts on, and graphite for media and background.
- **Do** reserve signal orange for the primary action, the NOW playhead and due emphasis.
- **Do** set labels in 10px Courier Prime with 0.2em tracking, and body copy in Archivo at 15–17px.
- **Do** separate surfaces with 1px hairlines and tonal steps.
- **Do** isolate destructive actions with space and a hairline.

### Don't:
- **Don't** add shadows, glass, gradients or glow; depth is tonal.
- **Don't** use rounded pills for panels, buttons or inputs; 2–4px only.
- **Don't** turn the dashboard into equal stat tiles or a card grid.
- **Don't** let a language colour become a large field; it is ink, dot or tick.
- **Don't** use mono for prose or as a generic "technical" costume.
- **Don't** put body copy on graphite; it belongs on enamel.
