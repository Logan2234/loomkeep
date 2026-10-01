import starlight from "@astrojs/starlight";
import { defineConfig, passthroughImageService } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";

export default defineConfig({
  site: "https://docs.loomkeep.app",
  // Only SVGs here: nothing to optimise, and no need for Sharp.
  image: { service: passthroughImageService() },
  // The API guides lived at the root before the docs covered the whole product.
  redirects: {
    "/authentication/": "/api/authentication/",
    "/conventions/": "/api/conventions/",
  },
  integrations: [
    starlight({
      title: "Loomkeep Docs",
      description:
        "Using, self-hosting and scripting Loomkeep, the tracker for series, films, anime, games, books and music.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { name: "theme-color", content: "#0c0d10" } },
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
        styleOverrides: {
          borderRadius: "0.5rem",
          codeFontFamily: "var(--sl-font-mono)",
        },
      },
      plugins: [
        // The reference is an Astro page of its own, outside Starlight's.
        starlightLinksValidator({ exclude: ["/api/reference/"] }),
        starlightLlmsTxt(),
      ],
      sidebar: [
        {
          label: "API",
          items: [
            { label: "Quick start", link: "/api/" },
            { label: "Authentication", link: "/api/authentication/" },
            { label: "Conventions", link: "/api/conventions/" },
            { label: "Reference", link: "/api/reference/" },
          ],
        },
        {
          label: "More",
          items: [
            { label: "Open Loomkeep", link: "https://loomkeep.app" },
            { label: "Status", link: "https://status.loomkeep.app" },
            {
              label: "Changelog",
              link: "https://feedback.loomkeep.app/changelog",
            },
            { label: "Roadmap", link: "https://feedback.loomkeep.app/roadmap" },
            { label: "Feedback", link: "https://feedback.loomkeep.app" },
          ],
        },
      ],
    }),
  ],
});
