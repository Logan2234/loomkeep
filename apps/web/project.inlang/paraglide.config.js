// Shared by the Vite plugin (dev, build, vitest) and the CLI (generate:paraglide).
// Paths resolve from apps/web, where every one of them runs.
export default {
  outdir: "./src/lib/paraglide",
  // Keep existing routes without locale prefixes. Explicit choices win,
  // then browser preferences, with English as the base-locale fallback.
  strategy: ["cookie", "preferredLanguage", "baseLocale"],
};
