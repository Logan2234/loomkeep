/** A reactive countdown in seconds, ticking down once per second until it hits 0. */
export class Cooldown {
  remaining = $state(0);
  #endsAt = 0;
  #timer: ReturnType<typeof setInterval> | undefined;

  start(seconds: number): void {
    this.remaining = seconds;
    this.#endsAt = Date.now() + seconds * 1000;
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      this.remaining = Math.max(
        0,
        Math.ceil((this.#endsAt - Date.now()) / 1000),
      );

      if (this.remaining <= 0) {
        clearInterval(this.#timer);
        this.#timer = undefined;
      }
    }, 1000);
  }

  stop(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
    this.remaining = 0;
  }
}
