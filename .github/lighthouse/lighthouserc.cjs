// web-audit's Lighthouse job, run once per form factor and page group:
//   LH_FORM_FACTOR=mobile|desktop LH_GROUP=public|app lhci collect --config=…
// One page per kind of screen rather than every route (Pa11y covers those):
// three runs of each page in both form factors already take half an hour.
const BASE = "http://localhost:18080";

const PAGES = {
  public: ["/", "/login", "/legal/privacy-policy"],
  app: [
    "/app",
    "/app/search",
    "/app/feed",
    "/app/media",
    "/app/books/OL893414W",
    "/app/music/6e335887-60ba-38f0-95af-fae7774336bf",
    `/app/lists/${process.env.LIST_ID}`,
    "/app/u/alice",
    "/app/stats",
    "/app/settings",
    "/app/settings/import/tvtime",
  ],
};

const group = process.env.LH_GROUP;
const desktop = process.env.LH_FORM_FACTOR === "desktop";

module.exports = {
  ci: {
    collect: {
      url: PAGES[group].map((path) => BASE + path),
      numberOfRuns: 3,
      chromePath: "/usr/bin/google-chrome",
      ...(group === "app" && {
        puppeteerScript: ".github/lighthouse/sign-in.cjs",
        puppeteerLaunchOptions: { args: ["--no-sandbox"] },
      }),
      settings: {
        ...(desktop && { preset: "desktop" }),
        chromeFlags: "--no-sandbox --force-prefers-reduced-motion",
        // Keeps the session sign-in.cjs opened.
        disableStorageReset: group === "app",
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: ".*",
          assertions: {
            "categories:accessibility": ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.9 }],
            // A shared runner's load swings it too much to be more than a hint.
            "categories:performance": ["warn", { minScore: 0.8 }],
          },
        },
        {
          // The pages meant to be indexed: the app and the sign-in pages are
          // noindex on purpose, which Lighthouse's SEO score counts against.
          matchingUrlPattern: `^${BASE}/(legal/.*)?$`,
          assertions: {
            "categories:seo": ["error", { minScore: 0.95 }],
          },
        },
      ],
    },
    upload: {
      target: "filesystem",
      outputDir: `./lighthouse-results/${desktop ? "desktop" : "mobile"}`,
    },
  },
};
