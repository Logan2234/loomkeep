// localStorage that never throws: it's missing during SSR and can refuse
// access (private mode, blocked site data, full quota). Every caller only
// stores per-device conveniences, so a failed read is "nothing stored" and a
// failed write is silently dropped.

export function readStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(key, value);
  } catch {
    // See the module comment.
  }
}

export function removeStorage(key: string): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.removeItem(key);
  } catch {
    // See the module comment.
  }
}
