import { m } from "#lib/paraglide/messages.js";
import { toast } from "#lib/toast.svelte.js";

const COPY_FEEDBACK_MS = 2000;

export class CopyFeedback<T = true> {
  value = $state<T | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #request = 0;

  async copy(
    text: string,
    value: T,
    duration = COPY_FEEDBACK_MS,
  ): Promise<boolean> {
    const request = ++this.#request;
    clearTimeout(this.#timer);

    try {
      await navigator.clipboard.writeText(text);
      if (request !== this.#request) return false;
      this.value = value;
      this.#timer = setTimeout(() => {
        this.value = null;
      }, duration);
      return true;
    } catch {
      if (request === this.#request) {
        this.value = null;
        toast.error(m.apierr_status_500());
      }

      return false;
    }
  }

  reset(): void {
    this.#request++;
    clearTimeout(this.#timer);
    this.value = null;
  }
}
