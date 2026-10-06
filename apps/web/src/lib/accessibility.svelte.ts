import { readStorage, writeStorage } from "#lib/local-storage.js";
import { browser } from "$app/env";

const MOTION_KEY = "lk-a11y-motion";
const CONTRAST_KEY = "lk-a11y-contrast";
const DENSITY_KEY = "lk-a11y-density";

export type MotionPreference = "system" | "reduce";
export type ContrastPreference = "default" | "high";
export type DensityPreference = "compact" | "default" | "comfortable";

export function motionPreference(value: string | null): MotionPreference {
  return value === "reduce" ? "reduce" : "system";
}

export function contrastPreference(value: string | null): ContrastPreference {
  return value === "high" ? "high" : "default";
}

export function densityPreference(value: string | null): DensityPreference {
  return value === "compact" || value === "comfortable" ? value : "default";
}

class AccessibilityState {
  motion = $state<MotionPreference>("system");
  contrast = $state<ContrastPreference>("default");
  density = $state<DensityPreference>("default");

  init(): void {
    if (!browser) return;
    this.motion = motionPreference(readStorage(MOTION_KEY));
    this.contrast = contrastPreference(readStorage(CONTRAST_KEY));
    this.density = densityPreference(readStorage(DENSITY_KEY));
    this.apply();
  }

  setMotion(value: MotionPreference): void {
    this.motion = value;
    this.save(MOTION_KEY, value);
    this.apply();
  }

  setContrast(value: ContrastPreference): void {
    this.contrast = value;
    this.save(CONTRAST_KEY, value);
    this.apply();
  }

  setDensity(value: DensityPreference): void {
    this.density = value;
    this.save(DENSITY_KEY, value);
    this.apply();
  }

  private save(key: string, value: string): void {
    if (browser) writeStorage(key, value);
  }

  private apply(): void {
    if (!browser) return;
    const root = document.documentElement;
    root.classList.toggle("a11y-reduce-motion", this.motion === "reduce");
    root.classList.toggle("a11y-high-contrast", this.contrast === "high");
    root.classList.toggle("a11y-compact", this.density === "compact");
    root.classList.toggle("a11y-comfortable", this.density === "comfortable");
  }
}

export const accessibility = new AccessibilityState();
