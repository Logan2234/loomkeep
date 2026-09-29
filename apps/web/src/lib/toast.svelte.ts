export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Milliseconds before it goes away on its own; 0 keeps it. */
  duration: number;
  action?: ToastAction;
}

// Global toast queue (rune store) — transient confirmations that don't need
// a full Banner or block the UI. Mounted once via <Toast /> in the root layout.
class ToastStore {
  items = $state<ToastItem[]>([]);
  #nextId = 0;

  show(
    message: string,
    variant: ToastVariant = "info",
    duration = 4000,
    action?: ToastAction,
  ): void {
    const id = this.#nextId++;
    this.items.push({ id, message, variant, duration, action });

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
