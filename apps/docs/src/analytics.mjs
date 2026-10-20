// Umami for docs.loomkeep.app, set by docs.yml from repository variables:
// a local build has neither, so it loads nothing.
const { UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID } = process.env;

export const umamiScript =
  UMAMI_SCRIPT_URL && UMAMI_WEBSITE_ID
    ? {
        defer: true,
        src: UMAMI_SCRIPT_URL,
        "data-website-id": UMAMI_WEBSITE_ID,
        "data-domains": "docs.loomkeep.app",
        "data-performance": "true",
      }
    : null;
