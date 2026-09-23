# Visual identity — "Séance"

Validated 2026-07-02. Applies to the whole `apps/web` front.

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

|         | Dark ("la salle") | Light ("le programme")                                    |
| ------- | ----------------- | --------------------------------------------------------- |
| bg      | `#0C0D10`         | `#F2EBDC` (warm manila, kept light — cards carry the pop) |
| surface | `#15171C`         | `#FFFFFF` (pure white, so cards lift off the cream bg)    |
| border  | `#2A2E38`         | `#D9CBA9`                                                 |
| text    | `#ECECEA`         | `#1C1712`                                                 |
| accent  | `#F5B841`         | `#96570A` (deep gold, AA-compliant as both text and fill) |

Primary button is asymmetric: amber fill in dark, ink fill in light.
Green/red are semantic only (success/danger), never decoration.

**Themes:** both light and dark shipped (toggle + system pref).

**Navigation:** collapsible icon **rail** on desktop (toggle button at top
expands it to a labelled sidebar; user avatar at bottom) + fixed **bottom tab
bar** on mobile. No horizontal top nav.

Implementation: Tailwind v4 (`@tailwindcss/vite`), semantic light/dark tokens
in `src/app.css`, shared component classes (`.btn`, `.input`, `.card`,
`.chip`, `.timecode`).
