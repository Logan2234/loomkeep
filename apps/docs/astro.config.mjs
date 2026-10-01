import starlight from "@astrojs/starlight";
import { defineConfig, passthroughImageService } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";
import starlightSidebarTopics from "starlight-sidebar-topics";

// Repeated at the bottom of every topic's sidebar.
const MORE = {
  label: "More",
  collapsed: true,
  items: [
    { label: "Open Loomkeep", link: "https://loomkeep.app" },
    { label: "Status", link: "https://status.loomkeep.app" },
    { label: "Changelog", link: "https://feedback.loomkeep.app/changelog" },
    { label: "Roadmap", link: "https://feedback.loomkeep.app/roadmap" },
    { label: "Feedback", link: "https://feedback.loomkeep.app" },
  ],
};

const SITE = "https://docs.loomkeep.app";

export default defineConfig({
  site: SITE,
  // Only SVGs here: nothing to optimise, and no need for Sharp.
  image: { service: passthroughImageService() },
  integrations: [
    starlight({
      title: "Loomkeep Docs",
      description:
        "Using, self-hosting and scripting Loomkeep, the tracker for series, films, anime, games, books and music.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { name: "theme-color", content: "#0c0d10" } },
        {
          tag: "meta",
          attrs: { property: "og:image", content: `${SITE}/og.png` },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
      ],
      customCss: ["./src/styles/seance.css"],
      // English only for now; a `fr` entry is all another language needs.
      locales: { root: { label: "English", lang: "en" } },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Logan2234/loomkeep",
        },
      ],
      components: { SocialIcons: "./src/components/SocialIcons.astro" },
      editLink: {
        baseUrl: "https://github.com/Logan2234/loomkeep/edit/main/apps/docs/",
      },
      lastUpdated: true,
      expressiveCode: {
        // Vesper's amber-on-black is close to Séance's dark room.
        themes: ["vesper", "github-light"],
        styleOverrides: {
          borderRadius: "0.5rem",
          borderColor: ({ theme }) =>
            theme.type === "dark" ? "#2a2e38" : "#d3c7a8",
          codeBackground: ({ theme }) =>
            theme.type === "dark" ? "#15171c" : "#ffffff",
          codeFontFamily: "var(--sl-font-mono)",
          uiFontFamily: "var(--sl-font)",
          frames: {
            shadowColor: "transparent",
            editorTabBarBackground: ({ theme }) =>
              theme.type === "dark" ? "#0c0d10" : "#edeae3",
            editorActiveTabBackground: ({ theme }) =>
              theme.type === "dark" ? "#15171c" : "#ffffff",
            editorActiveTabIndicatorTopColor: ({ theme }) =>
              theme.type === "dark" ? "#f5b841" : "#8e620b",
            terminalTitlebarBackground: ({ theme }) =>
              theme.type === "dark" ? "#0c0d10" : "#edeae3",
            terminalTitlebarBorderBottomColor: ({ theme }) =>
              theme.type === "dark" ? "#2a2e38" : "#d3c7a8",
            terminalBackground: ({ theme }) =>
              theme.type === "dark" ? "#15171c" : "#ffffff",
          },
        },
      },
      plugins: [
        // The reference is an Astro page of its own, outside Starlight's.
        starlightLinksValidator({
          exclude: ({ link }) => link.startsWith("/api/reference/"),
        }),
        starlightLlmsTxt(),
        starlightSidebarTopics(
          [
            {
              label: "Guide",
              link: "/guide/",
              icon: "open-book",
              items: [
                {
                  label: "Using Loomkeep",
                  items: [
                    { label: "Key concepts", link: "/guide/" },
                    "guide/install",
                    "guide/security",
                    "guide/your-data",
                    "guide/faq",
                  ],
                },
                {
                  label: "Importing",
                  items: [{ autogenerate: { directory: "guide/imports" } }],
                },
                MORE,
              ],
            },
            {
              label: "Self-hosting",
              link: "/self-hosting/",
              icon: "laptop",
              items: [
                {
                  label: "Getting started",
                  items: [
                    { label: "Overview", link: "/self-hosting/" },
                    "self-hosting/installation",
                    "self-hosting/catalogues",
                    "self-hosting/email-and-push",
                    "self-hosting/https",
                  ],
                },
                {
                  label: "Running it",
                  items: [
                    "self-hosting/configuration",
                    "self-hosting/instance-settings",
                    "self-hosting/administration",
                    "self-hosting/upgrades-and-backups",
                    "self-hosting/premium",
                    "self-hosting/troubleshooting",
                  ],
                },
                {
                  label: "Optional services",
                  items: [
                    {
                      autogenerate: {
                        directory: "self-hosting/optional-services",
                      },
                    },
                  ],
                },
                MORE,
              ],
            },
            {
              label: "API",
              link: "/api/",
              icon: "puzzle",
              items: [
                {
                  label: "Get started",
                  items: [
                    { label: "Quick start", link: "/api/" },
                    "api/authentication",
                    "api/concepts",
                    "api/conventions",
                  ],
                },
                {
                  label: "Recipes",
                  items: [{ autogenerate: { directory: "api/recipes" } }],
                },
                {
                  label: "Going further",
                  items: [
                    "api/errors",
                    "api/rate-limits",
                    "api/security",
                    "api/feeds",
                    "api/versioning",
                  ],
                },
                { label: "Reference", link: "/api/reference/" },
                MORE,
              ],
            },
            {
              label: "Project",
              link: "/project/",
              icon: "heart",
              items: [
                { label: "About", link: "/project/" },
                "project/contributing",
                "project/architecture",
                "project/security",
                "project/license",
                "project/translating",
                MORE,
              ],
            },
          ],
          // The home page is the way into every topic, not part of one.
          { exclude: ["/", "/404"] },
        ),
      ],
    }),
  ],
});
