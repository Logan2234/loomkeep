// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Cloudflare Turnstile's own script (loaded directly, not an npm
  // package — see lib/components/Turnstile.svelte) attaches this global.
  interface Window {
    turnstile?: {
      render(
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto"; // Defaults auto
          appearance?: "always" | "execute" | "interaction-only"; // Defaults always
          size?: "normal" | "flexible" | "compact"; // Defaults normal
          retry?: "auto" | "never"; // Defaults auto
          "retry-interval"?: number; // Defaults 8000
          "refresh-expired"?: "auto" | "manual" | "never"; // Defaults auto
          "refresh-timeout"?: "auto" | "manual" | "never"; // Defaults auto
          execution?: "render" | "execute"; // Defaults render
          language?: string; // Defaults auto
          "feedback-enabled"?: boolean; // Defaults true
          "offlabel-show-privacy"?: boolean; // Defaults true
          "offlabel-show-help"?: boolean; // Defaults true
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          "unsupported-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ): string;
      remove(widgetId: string): void;
    };
    // Quackback's feedback widget loader (queue-based stub replaced by the
    // real SDK once it loads) — see WidgetIdentify.svelte.
    Quackback?: {
      (...args: unknown[]): void;
      q?: unknown[][];
    };
  }
}

export {};
