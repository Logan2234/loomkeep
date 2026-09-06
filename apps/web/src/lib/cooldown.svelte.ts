/** A reactive countdown in seconds, ticking down once per second until it hits 0. */
export class Cooldown {
  remaining = $state(0);
  #timer: ReturnType<typeof setInterval> | undefined;

  start(seconds: number): void {
    this.remaining = seconds;
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      this.remaining -= 1;

      if (this.remaining <= 0) {
        clearInterval(this.#timer);
        this.#timer = undefined;
      }
    }, 1000);
  }
}
