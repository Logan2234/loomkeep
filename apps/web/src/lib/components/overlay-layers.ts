/**
 * Shared overlay layers, low to high: elevated side panels, modals, tooltips,
 * lightboxes — a picture opened from a modal or a panel always lands on top.
 * Kept below the browser's signed 32-bit cap, with room above each base for
 * what a component stacks on it (a Drawer's panel sits at its z-index + 10).
 */
export const ELEVATED_SIDE_PANEL_BACKDROP_Z_INDEX = 2_147_483_600;
export const MODAL_Z_INDEX = 2_147_483_620;
export const TOOLTIP_Z_INDEX = 2_147_483_640;
export const LIGHTBOX_Z_INDEX = 2_147_483_645;
