import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://docs.loomkeep.app",
  integrations: [
    starlight({
      title: "Loomkeep API",
      description:
        "Read your Loomkeep library, lists, calendar and stats with a personal API key.",
      customCss: ["./src/styles/seance.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Logan2234/loomkeep",
        },
      ],
      sidebar: [
        { label: "Introduction", link: "/" },
        { label: "Authentication", link: "/authentication/" },
        { label: "Conventions", link: "/conventions/" },
        { label: "API reference", link: "/api/" },
      ],
    }),
  ],
});
