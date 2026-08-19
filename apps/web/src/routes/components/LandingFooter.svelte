<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import {
    CHANGELOG_URL,
    FEEDBACK_BUG_REPORTS_URL,
    FEEDBACK_URL,
    GITHUB_REPO_URL,
    ROADMAP_URL,
  } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale, setLocale } from "$lib/paraglide/runtime.js";

  const COLUMNS: {
    title: string;
    links: { label: string; href: string; external?: boolean; event: string }[];
  }[] = [
    {
      title: m.landing_footer_col_product(),
      links: [
        {
          label: m.common_register(),
          href: "/register",
          event: "footer-register",
        },
        { label: m.landing_login(), href: "/login", event: "footer-login" },
        {
          label: m.landing_footer_link_roadmap(),
          href: ROADMAP_URL,
          external: true,
          event: "footer-roadmap",
        },
        {
          label: m.landing_footer_changelog(),
          href: CHANGELOG_URL,
          external: true,
          event: "footer-changelog",
        },
      ],
    },
    {
      title: m.landing_footer_col_contribute(),
      links: [
        {
          label: m.landing_footer_link_source(),
          href: GITHUB_REPO_URL,
          external: true,
          event: "footer-github",
        },
        {
          label: m.landing_footer_link_suggest(),
          href: FEEDBACK_URL,
          external: true,
          event: "footer-feedback",
        },
        {
          label: m.landing_footer_link_bug(),
          href: FEEDBACK_BUG_REPORTS_URL,
          external: true,
          event: "footer-bug-report",
        },
        {
          label: m.landing_footer_link_selfhost(),
          href: GITHUB_REPO_URL,
          external: true,
          event: "footer-selfhost",
        },
      ],
    },
    {
      title: m.landing_footer_col_legal(),
      links: [
        {
          label: m.common_legal_notice(),
          href: "/legal/legal-notice",
          event: "footer-legal-notice",
        },
        {
          label: m.common_privacy(),
          href: "/legal/privacy-policy",
          event: "footer-privacy",
        },
        {
          label: m.common_terms(),
          href: "/legal/terms-of-service",
          event: "footer-terms",
        },
      ],
    },
  ];
</script>

<footer class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 pt-12 md:px-8">
    <div class="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div>
        <span class="font-display text-xl font-extrabold tracking-tight">
          LOOM<span class="text-accent">KEEP</span>
        </span>
        <p class="text-dim mt-3 max-w-xs text-sm">
          {m.landing_footer_tagline()}
        </p>
        <ul class="text-dim mt-5 flex flex-col gap-1.5 text-xs">
          <li class="flex items-center gap-2">
            <Icon name="shield" class="h-3.5 w-3.5 shrink-0" />
            {m.landing_footer_license()}
          </li>
          <li class="flex items-center gap-2">
            <Icon name="download" class="h-3.5 w-3.5 shrink-0" />
            {m.landing_footer_export()}
          </li>
        </ul>
      </div>

      {#each COLUMNS as column (column.title)}
        <nav aria-label={column.title}>
          <p class="timecode text-[0.62rem] tracking-[0.18em] uppercase">
            {column.title}
          </p>
          <ul class="mt-4 flex flex-col gap-2.5">
            {#each column.links as link (link.label)}
              <li>
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  data-umami-event={link.event}
                  class="text-dim hover:text-fg text-sm transition-colors">
                  {link.label}
                </a>
              </li>
            {/each}
          </ul>
        </nav>
      {/each}
    </div>

    <div
      class="border-border text-dim mt-6 flex flex-wrap items-center justify-between gap-4 border-t py-3 text-xs">
      <p>{m.landing_footer_signature()}</p>
      <div
        class="border-border flex items-center gap-1 rounded-lg border p-0.5"
        role="group"
        aria-label={m.common_language()}>
        {#each Locale as locale (locale)}
          <button
            type="button"
            onclick={() => setLocale(locale)}
            aria-pressed={getLocale() === locale}
            class="rounded-md px-2 py-1 font-mono uppercase transition-colors"
            class:bg-surface-2={getLocale() === locale}
            class:text-fg={getLocale() === locale}>
            {locale}
          </button>
        {/each}
      </div>
    </div>
  </div>
</footer>
