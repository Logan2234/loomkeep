// Auth forms restore HttpOnly-cookie sessions on mount — nothing to render on the
// server. See app/+layout.ts for why this isn't set at the root anymore.
export const ssr = false;
