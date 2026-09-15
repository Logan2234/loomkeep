# Component library audit — implementation roadmap

Audit performed on the component catalogue at `/app/admin/components`.

Scope: shared UI primitives, their real application usages, visual responsive behavior, keyboard interactions, accessibility tree, i18n and existing tests. The audit was performed in the browser at desktop, tablet, portrait phone and short landscape phone sizes, in French and English, and in both themes. No source file was modified during the audit.

## Working principles

- Treat P1 items as a shared-primitive release: every real usage can be affected.
- Prefer evolving an existing component to introducing a parallel abstraction.
- Add regression coverage before or with each behavior change. Prioritize behavior and accessibility assertions over CSS snapshots.
- Preserve the Séance visual language. Correct contrast or interaction defects without replacing the visual identity.
- Validate all overlay and selection changes with keyboard navigation, reduced motion, French/English, 390 px portrait and 812 x 375 px landscape.

## P1 — shared interaction and accessibility defects

### DS-005 — Fix confirmed WCAG contrast failures

**Components:** `BetaBadge`, adult badge in `Poster`, error `Banner`, OMDb `ProviderMark`.

Correct the foreground/background combinations that fail WCAG AA in one or both themes:

- Beta badge: 2.49:1 in light theme and 4.44:1 in dark theme;
- adult badge in dark theme: 3.07:1;
- error banner in light theme: 4.30:1;
- OMDb monogram: 4.24:1.

Use semantic tokens or component-specific token pairs. Do not alter brand colors blindly; a border, background or accessible fallback treatment may be preferable for provider marks.

**Regression coverage:** axe contrast checks in both themes and visual review against the Séance palette.

## P2 — semantic quality, responsive resilience and maintainability

### DS-008 — Define SegmentedControl as a real selection control

**Component:** `SegmentedControl`.

Choose one accessible model and apply it consistently: either a labelled radiogroup or a labelled group of toggle buttons with `aria-pressed`. Implement a selected state that is announced, plus arrow-key navigation if using a radiogroup/roving model.

The locked state must explain why it is unavailable without relying on a disabled control alone.

**Regression coverage:** two and three choices; selected state; disabled/locked item; long labels; keyboard navigation; screen-reader tree.

### DS-009 — Redesign RatingPips interaction semantics

**Component:** `RatingPips`.

The rating is a single 0–10 value, not eleven independent pressed buttons. Use a radiogroup with roving tabindex or a discrete slider, while preserving a deliberate way to clear to `null` if the product needs it. Increase touch hit areas without making the row visually bulky.

**Regression coverage:** `null`, 0, 10 and selected values; arrow/Home/End keys; clear action; disabled and readonly state; legacy decimal values if supported.

### DS-010 — Add Banner live-region and severity semantics

**Component:** `Banner`.

Give error banners an appropriate `alert` behavior when newly introduced and use `status` or an opt-out live mode for success/information messages. Add a non-color-only severity marker where the component does not already have textual context. Avoid turning static page content into noisy live announcements.

**Regression coverage:** static banner; dynamically inserted error; success; warning; screen-reader announcement behavior.

### DS-011 — Keep PageHeader's heading clean

**Component:** `PageHeader`.

Move the back link and decorative icon outside the `h1`. Preserve the visual composition with sibling layout so heading navigation announces only the page title.

**Regression coverage:** French/English accessible heading name; multiline title on mobile and desktop.

### DS-012 — Give Lightbox the same page-locking guarantees as other overlays

**Component:** `Lightbox`.

Compose the shared overlay focus contract with `portal` and `scrollLock`. The page must not scroll behind an open lightbox, including PageDown and short viewport situations.

**Regression coverage:** image gallery; YouTube/video; failed image; keyboard navigation; close restoration; mobile short landscape; nested overlay if supported.

### DS-014 — Establish an accessible loading contract for skeletons

**Components:** `CardRowSkeleton`, `PosterGridSkeleton`, catalogue examples.

Skeleton primitives should be decorative (`aria-hidden`) by default. The parent loading region should own `aria-busy` and any accessible loading name. Remove invalid ARIA such as `aria-label` on a non-semantic `div`.

Do not add a new `LoadingRegion` component unless real usages demonstrate that a shared wrapper will reduce duplicated wiring.

**Regression coverage:** axe checks; loading list; loading grid; region transitioning to content.

### DS-017 — Add a focused interaction and accessibility test suite

**Components:** all shared interactive primitives, starting with P1 items.

Current direct coverage is nearly absent. Add browser and/or component tests that query by role/name and verify behavior rather than implementation classes. Run axe in light and dark catalog states.

Prioritized suite:

1. overlay focus and restoration;
2. Dropdown/Combobox keyboard behavior and placement;
3. Tooltip keyboard behavior;
4. Carousel keyboard behavior;
5. contrast and invalid-ARIA axe assertions;
6. ProgressBar, SegmentedControl, RatingPips and Banner semantics.

### DS-018 — Normalize touch hitboxes without inflating visual density

**Components/classes:** `Switch`, `.btn-icon`, `RatingPips`, chips.

Retain compact visuals but enlarge interactive hit areas towards 40–44 px using padding, wrapper geometry or pseudo-elements where appropriate. Document when compact desktop controls may intentionally be smaller and preserve spacing in dense lists.

**Regression coverage:** measured hitboxes on phone layouts and compact application rows.

### DS-P04 — Improve RelativeTime semantics only if product value warrants it

**Component:** `RelativeTime`.

Use a semantic `<time datetime>` element. Keep the full timestamp available via accessible text/title without desktop hover color behavior. Decide separately whether live refresh is needed: it should be bounded and justified by real long-lived pages, not added automatically.

**Regression coverage:** timestamp semantics and a long-open-page scenario only if refresh is introduced.

### DS-P07 — Decide whether Wizard is truly generic

**Component:** `Wizard`.

There is one real use outside the catalogue and its layout encodes modal/onboarding assumptions. Do not add more generic props now. Either document it as an onboarding-oriented component, or split reusable step-state logic from modal chrome only after a second real usage appears.

If it remains generic, define behavior for empty steps and invalid active indices rather than relying on an array access exception.

### DS-P08 — Establish form control/error wiring incrementally

**Components:** `PasswordInput`, `FieldError`; potential `FormField`.

Audit real auth/settings forms and ensure `id`, label, help text, `aria-invalid`, `aria-describedby`, disabled and readonly states can be wired without manual inconsistencies. Start by extending existing components. Introduce a composable `FormField` only if the audit finds repeated label/help/error wiring across multiple inputs.

**Regression coverage:** login, registration and reset-password errors with keyboard and screen-reader tree assertions.

## P3 — incremental refinements and validation-dependent improvements

### DS-P05 — Avoid duplicate accessible names in Poster and ProviderMark compositions

Add an explicit decorative/alt contract so a provider mark or poster image adjacent to an already-labelled link does not repeat the same name. Preserve meaningful defaults when `Poster` or `ProviderMark` is used independently. Validate with a real screen reader before changing the default behavior.

### DS-P09 — Add long-content cases and width constraints for floating UI

Add catalogue specimens with 80–120 character labels, provider names, options and translated strings. Constrain tooltip and Combobox panel widths to the viewport, allow intentional wrapping or truncation, then verify at 320 px and 200% zoom.

### Catalogue coverage improvements

Extend `/app/admin/components` only with states observed in real use or required to test the contracts above:

- button loading, long label and icon-plus-long-label;
- readonly, loading and long-label form states;
- Combobox empty search, error, disabled option, many options and long labels;
- Wizard blocked/busy/completed-step navigation where the current API supports it;
- banner action and long content;
- ProgressBar zero and indeterminate;
- modal/drawer non-dismissible, long content, form error and nested overlay;
- dropdown at bottom/right edges, disabled item and long menu;
- tooltip focus, Escape, collision and long content;
- Lightbox gallery, video and error states;
- RatingPips null/0/10/readonly;
- Carousel empty, one item, interactive/non-interactive contents and reduced motion.

### Local catalogue navigation affordance

At tablet width, the category navigation clips later sections without a clear scroll affordance. Preserve the compact horizontal navigation, but add an intentional affordance or layout so users can discover the remaining sections.

### Banner warning token decision

Review whether warning should use the dedicated `--warning` token rather than the primary Séance accent. This is a visual coherence decision, not an automatic refactor: compare existing feedback usages in both themes before changing it.

## Potential new components — defer until evidence supports them

### `FormField` — P2, conditional

Only create it after confirming repeated form wiring in several screens. It should provide a label, help/error association and state IDs while allowing an existing input component to own its presentation.

### `IconButton` — P3, incremental

Consider a thin wrapper around existing icon-button classes to standardize accessible label, `type`, pressed/loading state and hitbox. Do not bulk-migrate every icon action; adopt it during local changes if it reduces real duplication.

## Manual validation still required after implementation

- NVDA with Firefox and VoiceOver with Safari: overlays, multiselect Combobox, Switch, RatingPips, Tooltip and dynamic announcements.
- Real iPhone Safari and Android Chrome: Drawer/Carousel gestures, safe areas and keyboard overlays.
- Browser zoom at 200% and 400%.
- OS-level `prefers-reduced-motion`, especially Carousel and progress completion.
- Nested overlays, including confirmation modal launched from another overlay.
- Lightbox galleries, YouTube/video, image failure and touch navigation.
- Long content and translations at 320–390 px.
- PWA/browser chrome after the light theme color correction.
