/**
 * The origin links should point at. WEB_ORIGIN may list several,
 * comma-separated, for CORS (see main.ts); links always use the first.
 */
export function primaryWebOrigin(raw: string | undefined): string {
  return (
    raw?.split(",")[0]?.trim().replace(/\/$/, "") || "http://localhost:5173"
  );
}

export function webOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
