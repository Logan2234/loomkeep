# Component library audit — implementation roadmap

Audit performed on the component catalogue at `/app/admin/components`.

Scope: shared UI primitives, their real application usages, visual responsive behavior, keyboard interactions, accessibility tree, i18n and existing tests. The audit was performed in the browser at desktop, tablet, portrait phone and short landscape phone sizes, in French and English, and in both themes. No source file was modified during the audit.

## Working principles

- Treat P1 items as a shared-primitive release: every real usage can be affected.
- Prefer evolving an existing component to introducing a parallel abstraction.
- Add regression coverage before or with each behavior change. Prioritize behavior and accessibility assertions over CSS snapshots.
- Preserve the Séance visual language. Correct contrast or interaction defects without replacing the visual identity.
- Validate all overlay and selection changes with keyboard navigation, reduced motion, French/English, 390 px portrait and 812 x 375 px landscape.

## P2 — semantic quality, responsive resilience and maintainability

### DS-017 — Add a focused interaction and accessibility test suite

**Components:** all shared interactive primitives, starting with P1 items.

Current direct coverage is nearly absent. Add browser and/or component tests that query by role/name and verify behavior rather than implementation classes. Run axe in light and dark catalog states.

Prioritized suite:

1. overlay focus and restoration;
2. Dropdown/Combobox keyboard behavior and placement;
3. Tooltip keyboard behavior;
4. Carousel keyboard behavior;
5. contrast and invalid-ARIA axe assertions;
6. ProgressBar, SegmentedControl, RatingSlider and Banner semantics.

### DS-018 — Normalize touch hitboxes without inflating visual density

**Components/classes:** `Switch`, `.btn-icon`, `RatingSlider`, chips.

Retain compact visuals but enlarge interactive hit areas towards 40–44 px using padding, wrapper geometry or pseudo-elements where appropriate. Document when compact desktop controls may intentionally be smaller and preserve spacing in dense lists.

**Regression coverage:** measured hitboxes on phone layouts and compact application rows.

### DS-P08 — Establish form control/error wiring incrementally

**Components:** `PasswordInput`, `FieldError`; potential `FormField`.

Audit real auth/settings forms and ensure `id`, label, help text, `aria-invalid`, `aria-describedby`, disabled and readonly states can be wired without manual inconsistencies. Start by extending existing components. Introduce a composable `FormField` only if the audit finds repeated label/help/error wiring across multiple inputs.

**Regression coverage:** login, registration and reset-password errors with keyboard and screen-reader tree assertions.

## P3 — incremental refinements and validation-dependent improvements

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
- RatingSlider null/0/10/readonly;
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

- NVDA with Firefox and VoiceOver with Safari: overlays, multiselect Combobox, Switch, RatingSlider, Tooltip and dynamic announcements.
- Real iPhone Safari and Android Chrome: Drawer/Carousel gestures, safe areas and keyboard overlays.
- Browser zoom at 200% and 400%.
- OS-level `prefers-reduced-motion`, especially Carousel and progress completion.
- Nested overlays, including confirmation modal launched from another overlay.
- Lightbox galleries, YouTube/video, image failure and touch navigation.
- Long content and translations at 320–390 px.
- PWA/browser chrome after the light theme color correction.
