/**
 * Sequencing for [G6]'s unlock bubble: one bubble on screen at a time, in
 * reading order, each sliding in from the top, holding, then sliding back
 * out before the next one enters.
 *
 * Deliberately plain TypeScript with a subscribe callback rather than a rune
 * store: the timing rules are the part worth testing, and keeping them free
 * of `$state` lets a unit test drive them with fake timers. The component
 * mirrors `current` into a rune of its own.
 *
 * Shaped after `$lib/toast.svelte.ts` (a global queue of transient
 * messages), but deliberately not reusing it: Toast is anchored at the
 * bottom, shows several at once, and carries system messages. This is a
 * different object with different rules.
 */
import { prefersReducedMotion } from "$lib/motion";

/** One achievement unlock the API hasn't been told we displayed yet. */
export interface AchievementUnlock {
  kind: "achievement";
  /** `UserAchievement.id` — what PATCH /achievements/:id/displayed takes. */
  id: string;
  key: string;
  xp: number;
}

/**
 * A level crossed since the last visit. Rides the same queue as achievement
 * unlocks — it is the same bubble with another skin, not a second mechanism.
 */
export interface LevelUnlock {
  kind: "level";
  id: string;
  level: number;
}

export type UnlockBubble = AchievementUnlock | LevelUnlock;

export const ENTER_MS = 420;
export const EXIT_MS = 280;
/**
 * Long enough to actually land. The first pass held for 2s and read as a
 * flicker in practice: the celebration animation needs to finish before the
 * eye has even reached the name.
 */
export const HOLD_MS = 4200;
/** Shortened hold once a run gets long — a backlog shouldn't hold the app hostage. */
export const HOLD_RUSHED_MS = 2200;
/** 0-based index of the first rushed bubble, i.e. the 4th of a run. */
export const RUSH_FROM = 3;

/** `playedBefore` = how many bubbles already played in the current run. */
export function holdFor(playedBefore: number): number {
  return playedBefore >= RUSH_FROM ? HOLD_RUSHED_MS : HOLD_MS;
}

interface UnlockQueueOptions {
  /**
   * Called the moment a bubble goes on screen, and for everything still
   * queued when `stop()` cuts the run short — "displayed" means "the user
   * had their chance to see it", so nothing is ever replayed on the next
   * app open.
   */
  onDisplayed?: (bubble: UnlockBubble) => void;
  /** Overridable so a test can pin the timings; defaults to the real setting. */
  reducedMotion?: () => boolean;
}

export class UnlockQueue {
  #pending: UnlockBubble[] = [];
  #current: UnlockBubble | null = null;
  #played = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #listeners = new Set<(current: UnlockBubble | null) => void>();
  // Every bubble ever queued this session. The pending endpoint keeps
  // returning a row until its PATCH lands, so a refetch would otherwise
  // replay bubbles that are still on screen.
  #queued = new Set<string>();
  readonly #onDisplayed: (bubble: UnlockBubble) => void;
  readonly #reducedMotion: () => boolean;

  constructor(options: UnlockQueueOptions = {}) {
    this.#onDisplayed = options.onDisplayed ?? (() => {});
    this.#reducedMotion = options.reducedMotion ?? prefersReducedMotion;
  }

  /** The bubble on screen, null between two of them (and once the run ends). */
  get current(): UnlockBubble | null {
    return this.#current;
  }

  /** Bubbles waiting behind the one playing. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Fires immediately with the present value, then on every change. */
  subscribe(listener: (current: UnlockBubble | null) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#current);
    return () => this.#listeners.delete(listener);
  }

  /** Appends bubbles (ignoring ids already queued) and starts the run if idle. */
  enqueue(bubbles: UnlockBubble[]): void {
    for (const bubble of bubbles) {
      if (this.#queued.has(bubble.id)) continue;
      this.#queued.add(bubble.id);
      this.#pending.push(bubble);
    }

    if (!this.#current && this.#timer === null) this.#advance();
  }

  /** The cross, or a swipe up: the current bubble leaves, the next one enters. */
  dismiss(): void {
    if (!this.#current) return;
    this.#clearTimer();
    this.#hide();
  }

  /**
   * A click through to the achievement: the whole run ends here. Everything
   * still queued counts as displayed — the user chose to go look instead.
   */
  stop(): void {
    this.#clearTimer();
    for (const bubble of this.#pending) this.#onDisplayed(bubble);
    this.#pending = [];
    this.#current = null;
    this.#played = 0;
    this.#notify();
  }

  /** Drops everything without marking anything displayed (component teardown). */
  destroy(): void {
    this.#clearTimer();
    this.#listeners.clear();
  }

  #advance(): void {
    const next = this.#pending.shift();

    if (!next) {
      this.#current = null;
      this.#played = 0;
      this.#notify();
      return;
    }

    this.#current = next;
    this.#notify();
    this.#onDisplayed(next);

    // The hold starts once the bubble has finished sliding in, so a rushed
    // bubble is still readable for its full 1.2s.
    const enter = this.#reducedMotion() ? 0 : ENTER_MS;
    const hold = holdFor(this.#played);
    this.#played++;
    this.#timer = setTimeout(() => this.#hide(), enter + hold);
  }

  #hide(): void {
    this.#current = null;
    this.#notify();
    // Waits out the exit animation before the next bubble enters — two of
    // them sliding through each other at the same edge reads as a glitch.
    const exit = this.#reducedMotion() ? 0 : EXIT_MS;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#advance();
    }, exit);
  }

  #clearTimer(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #notify(): void {
    for (const listener of this.#listeners) listener(this.#current);
  }
}
