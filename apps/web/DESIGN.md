# Visual identity — "Séance"

Validated 2026-07-02 and reconciled with the shipped tokens on 2026-09-12.
Applies to the whole `apps/web` front. The semantic custom properties in
`src/app.css` are the source of truth; this document records their intent and
current values.

**Concept:** the two themes mean something — dark = "la salle" (lights off,
poster glows), light = "le programme" (paper). Signature devices: metadata as
a **timecode in a mono font** (year, `S01E04`, `2:46:00`, `12 / 24`), thin
**letterbox** hairline rules, rating shown as an **amber "marquee" cartouche**.

**Typography** (self-hosted via `@fontsource`, no runtime external calls):

- Display / titles: **Bricolage Grotesque** (chosen over Fraunces).
- Body / UI: **Hanken Grotesk** (replaces the old Inter).
- Data / timecodes: **Space Mono**.

**Smallest readable size** — running text that carries information (a cast
role, a legal notice, a caption) uses `.text-micro`: 11px on a phone, 12px
once there is room.

Pills are the exception and stay at `text-[0.6rem]`: a badge is read as a
shape and a colour before it is read as a word (ADMIN, PREMIUM, DÉBLOQUÉ,
NOUVEAU), and at 12px they stop reading as pills at all.

**Palette** — single ownable accent = **projector amber**.

| Token     | Dark ("la salle") | Light ("le programme")                                    |
| --------- | ----------------- | --------------------------------------------------------- |
| bg        | `#0C0D10`         | `#F7F5F3` (warm paper; cards carry the visual lift)       |
| surface   | `#15171C`         | `#FFFFFF`                                                 |
| surface-2 | `#1E2128`         | `#EDEAE3`                                                 |
| border    | `#2A2E38`         | `#D3C7A8`                                                 |
| fg        | `#ECECEA`         | `#1C1712`                                                 |
| dim       | `#9AA0AE`         | `#6B6354`                                                 |
| accent    | `#F5B841`         | `#8E620B` (deep gold, AA-compliant as both text and fill) |
| accent-fg | `#1A1406`         | `#FFFFFF`                                                 |
| button    | `#F5B841`         | `#1C1712`                                                 |
| button-fg | `#1A1406`         | `#FFFFFF`                                                 |
| success   | `#5BD6A0`         | `#257E58`                                                 |
| danger    | `#F0647C`         | `#C73C57`                                                 |
| warning   | `#FFA552`         | `#AB590D`                                                 |

Primary button is asymmetric: amber fill in dark, ink fill in light.
Green/red are semantic only (success/danger), never decoration.

**Themes:** both light and dark shipped (toggle + system pref).

**Navigation:** collapsible icon **rail** on desktop (toggle button at top
expands it to a labelled sidebar; user avatar at bottom) + fixed **bottom tab
bar** on mobile. No horizontal top nav.

**Motion** — part of the feature, never a later polish pass: every UI change
ships the transitions of what it adds.

- What moves: anything that appears, disappears, expands or collapses
  (sections, modals, menus, toasts), and every state change a pointer or a key
  causes (hover, focus, pressed, selected, a chevron turning).
- Character: quiet and precise, like the light of a projector — fades, short
  slides, a slight scale (never below 0.95), colour and brightness shifts.
  Never bouncy, elastic or cartoonish: no overshoot, no spring wobble, no
  spinning or wiggling icons, no long travel across the screen.
- Timing: ~150 ms for hover, press and colour; 180–250 ms for entering,
  leaving, expanding; ease-out in, ease-in out. Nothing past 300 ms except a
  deliberate one-off moment (a level reached, a count-up), and those stay
  under 500 ms.
- How: CSS transitions (`transition-colors`, `transition-transform`,
  `duration-150`/`200`) for state changes; Svelte's `fade`/`slide`/`scale` for
  what enters or leaves the DOM. Animate opacity, transform, colour and
  filter — not layout, so nothing around the movement shifts (Svelte's
  `slide` is the one exception, for unfolding content).
- Reduced motion: Svelte transitions take their duration from
  `prefersReducedMotion()` (`$lib/motion`, `duration: reduced ? 0 : 200`), and
  spatial CSS ones (transform) add `motion-reduce:transition-none`. Colour
  fades may stay.

Implementation: Tailwind v4 (`@tailwindcss/vite`), semantic light/dark tokens
in `src/app.css`, shared component classes (`.btn`, `.input`, `.card`,
`.chip`, `.timecode`).
