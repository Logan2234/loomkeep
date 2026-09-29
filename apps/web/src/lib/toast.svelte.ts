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
  action?: ToastAction;
}

// Global toast queue (rune store) — transient confirmations that don't need
// a full Banner or block the UI. Mounted once via <Toast /> in the root layout.
export class ToastStore {
  items = $state<ToastItem[]>([]);
  #nextId = 0;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(
    message: string,
    variant: ToastVariant = "info",
    duration = 4000,
    action?: ToastAction,
  ): number {
    const id = this.#nextId++;
    this.items.push({ id, message, variant, duration, action });

    if (duration > 0) {
      this.#timers.set(
        id,
        setTimeout(() => this.dismiss(id), duration),
      );
    }

    return id;
  }

  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  action(
    message: string,
    action: ToastAction,
    variant: ToastVariant = "info",
    duration = 8000,
  ): number {
    return this.show(message, variant, duration, action);
  }

  selectAction(id: number): void {
    const item = this.items.find((toast) => toast.id === id);
    if (!item?.action) return;
    this.dismiss(id);
    item.action.onSelect();
  }

  dismiss(id: number): void {
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
