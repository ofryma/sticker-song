# Frontend rules — Memorial Stickers

Applies to everything under `frontend/`.

A memorial archive: people photograph stickers commemorating fallen individuals
found in public space, and the app preserves them.

**The purpose is remembrance, not mourning.** These people are remembered for who
they were and what they gave, not for how they were lost. The interface should
feel like light, warmth and life — respectful and dignified, never sad, never
funereal. Every decision — copy, motion, colour, imagery, features — is held to
that standard. Read "Direction" below before changing anything visual.

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

## Direction — remembrance, not mourning

This is the standing direction, and the palette, the mark and the copy already
follow it. Work stays inside it; nothing moves back toward a night vigil.

- **Light, never dark.** The archive reads as daylight. Every surface is one of
  the `day-*` tokens (parchment and warm limestone) and every text colour is an
  `ink-*` token. There is no dark theme and no dark surface — not for a hero, a
  modal, a scrim, or a photo backdrop.
- **Living accents.** `olive-*` for growth, continuity and anything a visitor has
  given or chosen; `sun-*` for warmth, labels and pools of light; `tekhelet-*` for
  primary actions and links. Only `sun-deep` and `olive-deep` are dark enough to
  carry text on `day`.
- **Photographs are shown whole and in colour.** No greyscale, no desaturation,
  no dimming, and nothing written across a face — a name goes on paper beneath the
  photo, as on `EntryCard` and the collage tiles.
- **Positive gestures, not grieving rituals.** The remembering gesture is a leaf
  (`Sprig.jsx`, `useLeaves.js`): a visitor adds a leaf to a person, it grows into
  place, and it is kept on their device and never counted. New features belong to
  the same family — life, growth, continuity, a memory or a good deed added
  alongside a photo — and never to lighting, kindling or keeping a flame.
- **Remember the person, not the loss.** Copy and framing centre on who someone
  was. Avoid the vocabulary of grief and ritual — mourning, vigil, yahrzeit,
  candle, darkness, silence — unless a person's own sticker text uses it.
- **Warm, not sombre.** Warmth comes from light, space, generous type and plain
  human words. It never comes from confetti, streaks, counters, badges or
  gamification: no exclamation marks, no emoji, no "Awesome!", no counts framed
  as achievements. A submission is met with genuine, unhurried thanks.

### The palette, in one place

`src/tokens.css` is the source; `hero.js` mirrors it for HeroUI.

| Family        | Members                                   | Used for                              |
| ------------- | ----------------------------------------- | ------------------------------------- |
| `day-*`       | `day`, `-soft`, `-warm`, `-line`          | every surface, in that order of depth |
| `ink-*`       | `ink`, `-soft`, `-muted`, `-faint`        | all text; `-faint` only for disabled  |
| `tekhelet-*`  | `tekhelet`, `-deep`, `-light`, `-pale`    | primary actions, links, focus rings   |
| `olive-*`     | `olive`, `-deep`, `-light`, `-pale`       | the leaf, growth, chosen or given     |
| `sun-*`       | `sun`, `-deep`, `-light`, `-pale`         | warmth, eyebrows, light, cautions     |

Motion tokens: `animate-rise`, `-fade`, `-fade-slow`, `-sheet`, `-unfurl` (a leaf
opening), `-breathe` (waiting), `-drift` (pools of light), all on `ease-calm`.

## Tone and motion

- **Unhurried.** Transitions are 700ms–2500ms. `ease-out` or the custom
  `ease-calm` easing. Nothing bounces, springs, pops, or overshoots. No spinners
  that whip around; waiting is three olive marks on `animate-breathe`. HeroUI
  ripples are off (`disableRipple` in `Action`) — a ripple is a pop. Calm is the
  goal, not heaviness.
- **Gentle.** Reveal by fading and rising a few pixels. Content enters once, on
  scroll, and stays. Prefer opacity and small translations over scale.
- **Respect `prefers-reduced-motion`.** Every animation must degrade to a plain
  static state. The `motion-safe:` / `motion-reduce:` variants exist for this.

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

Keyboard reachable, visible focus rings (`focus-visible:ring-tekhelet`), labelled
inputs, `alt` text on every image, modals trap focus and close on Escape.

## Talking to the backend

Every call goes through `src/lib/api.js` against `/api` (Vite proxies it to
FastAPI). Components never call `fetch` directly. The backend is out of scope for
frontend work — see `README.md` for the endpoint list, and do not modify
`backend/` while working on the UI.
