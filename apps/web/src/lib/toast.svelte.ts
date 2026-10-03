export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
  actions: ToastAction[];
}

interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null;
  endsAt: number;
  remaining: number;
}

// Global toast queue (rune store) — transient confirmations that don't need
// a full Banner or block the UI. Mounted once via <Toast /> in the root layout.
export class ToastStore {
  items = $state<ToastItem[]>([]);
  #nextId = 0;
  #timers = new Map<number, ToastTimer>();

  show(
    message: string,
    variant: ToastVariant = "info",
    duration = 4000,
    actions: ToastAction[] = [],
  ): number {
    const id = this.#nextId++;
    this.items.push({ id, message, variant, duration, actions });

    if (duration > 0) {
      this.#timers.set(id, { handle: null, endsAt: 0, remaining: duration });
      this.resume(id);
    }

    return id;
  }

  /** Holds the countdown while the toast is being read or reached for. */
  pause(id: number): void {
    const timer = this.#timers.get(id);
    if (!timer?.handle) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(0, timer.endsAt - Date.now());
  }

  resume(id: number): void {
    const timer = this.#timers.get(id);
    if (!timer || timer.handle) return;
    timer.endsAt = Date.now() + timer.remaining;
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  action(
    message: string,
    action: ToastAction | ToastAction[],
    variant: ToastVariant = "info",
    duration = 8000,
  ): number {
    const actions = Array.isArray(action) ? action : [action];
    return this.show(message, variant, duration, actions);
  }

  selectAction(id: number, index = 0): void {
    const item = this.items.find((toast) => toast.id === id);
    const action = item?.actions[index];
    if (!action) return;
    this.dismiss(id);
    action.onSelect();
  }

  dismiss(id: number): void {
    const timer = this.#timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.#timers.delete(id);
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
