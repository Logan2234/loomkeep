// localStorage that never throws: it's missing during SSR and can refuse
// access (private mode, blocked site data, full quota). Every caller only
// stores per-device conveniences, so a failed read is "nothing stored" and a
// failed write is silently dropped.

export function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // See the module comment.
  }
}

export function removeStorage(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // See the module comment.
  }
}

export function readSessionStorage(key: string): string | null {
  try {
    return typeof sessionStorage === "undefined"
      ? null
      : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key, value);
  } catch {
    /* Storage is optional for per-device conveniences. */
  }
}

export function removeSessionStorage(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
  } catch {
    /* Storage is optional for per-device conveniences. */
  }
}
