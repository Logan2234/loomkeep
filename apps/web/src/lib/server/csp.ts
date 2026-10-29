/**
 * The Content-Security-Policy is built by SvelteKit (`csp` in
 * vite.config.ts), which nonces its own scripts and app.html's. Those
 * directives are fixed at build time, but the images are built once for
 * every instance: the origins of the integrations an instance configures
 * (its API, Umami, GlitchTip, Unleash, Quackback) are only known at runtime,
 * from the same env vars the app reads, and are appended here.
 */

type Env = Partial<
  Record<
    | "PUBLIC_API_URL"
    | "PUBLIC_GLITCHTIP_WEB_DSN"
    | "PUBLIC_QUACKBACK_URL"
    | "PUBLIC_UMAMI_SCRIPT_URL"
    | "PUBLIC_UNLEASH_FRONTEND_URL",
    string | undefined
  >
>;

type Sources = Record<string, string[]>;

/** Origin of an absolute URL, credentials stripped; nothing for a relative or unset one. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const { origin } = new URL(url);
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

export function integrationSources(env: Env): Sources {
  const api = originOf(env.PUBLIC_API_URL);
  const umami = originOf(env.PUBLIC_UMAMI_SCRIPT_URL);
  const quackback = originOf(env.PUBLIC_QUACKBACK_URL);
  const present = (...origins: (string | null)[]) =>
    origins.filter((origin): origin is string => origin !== null);

  return {
    "script-src": present(umami, quackback),
    "connect-src": present(
      api,
      // The realtime socket's WebSocket upgrade to that same API origin.
      api && api.replace(/^http/, "ws"),
      umami,
      originOf(env.PUBLIC_GLITCHTIP_WEB_DSN),
      originOf(env.PUBLIC_UNLEASH_FRONTEND_URL),
      quackback,
    ),
    "frame-src": present(quackback),
  };
}

/**
 * Appends each directive's sources to `header`, skipping those already in
 * it. Only to directives the header has: vite.config.ts declares every one
 * listed above, and a directive created here would lose the `'self'` it
 * inherited from `default-src`.
 */
export function extendCsp(header: string, sources: Sources): string {
  const directives = header
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .map((directive) => directive.split(/\s+/));

  for (const [name, values] of Object.entries(sources)) {
    const directive = directives.find(([key]) => key === name);
    if (!directive) continue;

    for (const value of values) {
      if (!directive.includes(value)) directive.push(value);
    }
  }

  return directives.map((directive) => directive.join(" ")).join("; ");
}
