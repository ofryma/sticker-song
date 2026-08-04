# Frontend rules — Memorial Stickers

Applies to everything under `frontend/`.

A memorial archive: people photograph stickers commemorating fallen individuals
found in public space, and the app preserves them. The subject matter is grief.
Every decision — copy, motion, color, error messages — is held to that standard.

## Hard rules

1. **No frontend file may exceed 300 lines of code.** If a file approaches the
   limit, extract a component, a hook, or a module. This applies to every file
   under `frontend/` (`.jsx`, `.js`, `.css`, config). Check with
   `find frontend/src -type f | xargs wc -l | sort -n` before finishing work.
2. **HeroUI first.** Buttons, inputs, modals, cards, chips and the navbar come
   from `@heroui/react` — never hand-rolled. Every button goes through
   `src/components/ui/Action.jsx` so tone, radius and timing live in one place;
   add a tone there rather than passing one-off HeroUI props at the call site.
   Themeing is in `hero.js`, which maps HeroUI's semantic tokens onto the
   palette; change colours there, not per component.
3. **Tailwind (v4) for layout and everything HeroUI does not cover.** No inline
   `style` objects except genuinely dynamic values (computed transforms,
   animation delays, collage geometry), and no CSS-in-JS. Shared primitives live
   in `src/index.css` under `@layer components`.
4. **Design tokens over literals.** Colours, fonts, easings, durations and
   keyframes are defined in `src/tokens.css` under `@theme` — Tailwind v4 is
   CSS-first, so there is no `tailwind.config.js`. Never hardcode a hex value in
   a component.
5. **No new runtime dependencies** without asking. The stack is React +
   react-router-dom + Tailwind + HeroUI + framer-motion (which arrives with
   HeroUI). Prefer CSS animation; reach for framer-motion only where presence
   transitions need it, as the collage does.

## Tone and motion

- **Slow.** Transitions are 700ms–2500ms. `ease-out` or custom `ease-memorial`.
  Nothing bounces, springs, pops, or overshoots. No spinners that whip around.
  HeroUI ripples are off (`disableRipple` in `Action`) — a ripple is a pop.
- **Quiet.** Reveal by fading and rising a few pixels. Content enters once, on
  scroll, and stays. Prefer opacity and small translations over scale.
- **Respect `prefers-reduced-motion`.** Every animation must degrade to a plain
  static state. The `motion-safe:` / `motion-reduce:` variants exist for this.
- **Copy is plain and never celebratory.** No exclamation marks, no emoji, no
  "Awesome!", no gamification, no counts framed as achievements. A submission is
  acknowledged with thanks, not confetti.

## Layout and language

- **Type.** `font-display` (Suez One) for titles, `font-serif` (David Libre) for
  names and transcribed sticker text, `font-sans` (Assistant) for interface
  chrome. Never set a family any other way.
- The interface is bilingual Hebrew/English. Hebrew is the default and the
  document direction flips with the language (`dir="rtl"`). Use logical CSS
  properties via Tailwind (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`,
  `text-end`) — never `pl-*`/`pr-*`/`left-*`/`right-*` for content flow.
- All user-facing strings live in `src/i18n/he.js` and `src/i18n/en.js` and are
  read through the `useI18n()` hook. No literal UI text in components.

## Structure

```
src/
  i18n/          language dictionaries + provider
  lib/           api client, formatting helpers — no React
  hooks/         reusable behavior (reveal on scroll, data fetching)
  components/    presentational, reusable
  components/ui/ thin wrappers over HeroUI (Action)
  components/collage/  the drifting wall: layout data, tile, engine
  pages/         one file per route, composes components
```

## Accessibility

Keyboard reachable, visible focus rings (`focus-visible:ring-flame`), labelled
inputs, `alt` text on every image, modals trap focus and close on Escape.

## Talking to the backend

Every call goes through `src/lib/api.js` against `/api` (Vite proxies it to
FastAPI). Components never call `fetch` directly. The backend is out of scope for
frontend work — see `README.md` for the endpoint list, and do not modify
`backend/` while working on the UI.
