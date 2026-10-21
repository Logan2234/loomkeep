import { m } from "./paraglide/messages.js";

/**
 * The identity confirmation sensitive actions ask for. `core.ts` opens it when
 * the API answers `auth.reauth_required`, then replays the request; the one
 * `ReauthModal` mounted in the app layout shows it. Requests that need it at
 * the same time share a single confirmation.
 */
class Reauth {
  /** Why it's asked, while the modal is open. */
  reason = $state<string | null>(null);
  /** When this session's confirmation runs out, in ms; 0 without one. */
  confirmedUntil = $state(0);

  #settle: ((confirmed: boolean) => void) | null = null;
  #pending: Promise<boolean> | null = null;

  /** Resolves true once the person confirmed it's them, false if they closed it. */
  confirm(reason: string): Promise<boolean> {
    this.#pending ??= new Promise<boolean>((resolve) => {
      this.reason = reason;
      this.#settle = resolve;
    }).finally(() => {
      this.reason = null;
      this.#settle = null;
      this.#pending = null;
    });
    return this.#pending;
  }

  confirmed(until: string): void {
    this.confirmedUntil = Date.parse(until);
    this.#settle?.(true);
  }

  cancelled(): void {
    this.#settle?.(false);
  }
}

export const reauth = new Reauth();

/** What the action about to run does, said in the modal. */
export function reauthReason(method: string, path: string): string {
  if (method === "POST" && path.startsWith("/api-keys")) {
    return m.reauth_reason_api_key();
  }

  if (path.startsWith("/auth/sessions")) return m.reauth_reason_sessions();
  if (path.startsWith("/users/me/email")) return m.reauth_reason_email();
  if (path.startsWith("/users/me/mfa")) return m.reauth_reason_mfa();
  if (path.startsWith("/admin/backup")) return m.reauth_reason_restore();

  if (method === "POST" && path === "/users/me/deletion") {
    return m.reauth_reason_delete();
  }

  return m.reauth_reason_default();
}
