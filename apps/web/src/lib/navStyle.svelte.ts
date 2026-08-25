import { browser } from "$app/environment";

const STORAGE_KEY = "tl-nav-style";

export type NavStyle = "marquee" | "dock" | "board";

export const NAV_STYLE_META: Record<
  NavStyle,
  { label: string; blurb: string; premium: boolean }
> = {
  marquee: {
    label: "Marquee",
    blurb: "Le rail actuel, avec un repère qui glisse d'un item à l'autre.",
    premium: false,
  },
  dock: {
    label: "Dock",
    blurb: "Un dock flottant détaché du bord, icônes seules.",
    premium: true,
  },
  board: {
    label: "Programme",
    blurb: "Un rail fin qui déploie un annuaire au survol.",
    premium: true,
  },
};

// Cosmetic-only preference — kept in localStorage rather than on the user
// record (like the rail's "pinned" flag), since it doesn't need to sync
// across devices. Premium gating is applied by the caller (auth.isPremium +
// the "premium-features" flag aren't known here), not by this store.
class NavStyleState {
  choice = $state<NavStyle>("marquee");

  init(): void {
    if (!browser) return;
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === "marquee" || saved === "dock" || saved === "board") {
      this.choice = saved;
    }
  }

  set(style: NavStyle): void {
    this.choice = style;
    if (browser) localStorage.setItem(STORAGE_KEY, style);
  }
}

export const navStyle = new NavStyleState();
