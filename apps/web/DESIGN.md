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

Implementation: Tailwind v4 (`@tailwindcss/vite`), semantic light/dark tokens
in `src/app.css`, shared component classes (`.btn`, `.input`, `.card`,
`.chip`, `.timecode`).
