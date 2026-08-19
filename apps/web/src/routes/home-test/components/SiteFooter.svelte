<script lang="ts">
  // Richer footer for the assembled prototype: three link columns, a signature
  // line and the language switch, instead of the flat row of links the earlier
  // prototypes share.
  import Icon from "$lib/components/Icon.svelte";
  import {
    CHANGELOG_URL,
    FEEDBACK_URL,
    FEEDBACK_BUG_REPORTS_URL,
    GITHUB_REPO_URL,
    ROADMAP_URL,
  } from "$lib/constants/external-links";

  const COLUMNS: {
    title: string;
    links: { label: string; href: string; external?: boolean }[];
  }[] = [
    {
      title: "Produit",
      links: [
        { label: "Créer un compte", href: "/register" },
        { label: "Se connecter", href: "/login" },
        { label: "Feuille de route", href: ROADMAP_URL, external: true },
        { label: "Notes de version", href: CHANGELOG_URL, external: true },
      ],
    },
    {
      title: "Participer",
      links: [
        { label: "Code source", href: GITHUB_REPO_URL, external: true },
        { label: "Proposer une idée", href: FEEDBACK_URL, external: true },
        {
          label: "Signaler un bug",
          href: FEEDBACK_BUG_REPORTS_URL,
          external: true,
        },
        {
          label: "Héberger soi-même",
          href: GITHUB_REPO_URL,
          external: true,
        },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Mentions légales", href: "/legal/legal-notice" },
        { label: "Confidentialité", href: "/legal/privacy-policy" },
        { label: "Conditions d'utilisation", href: "/legal/terms-of-service" },
      ],
    },
  ];
</script>

<footer class="border-border border-t">
  <div class="mx-auto max-w-5xl px-5 py-12 md:px-8">
    <div class="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div>
        <span class="font-display text-xl font-extrabold tracking-tight">
          LOOM<span class="text-accent">KEEP</span>
        </span>
        <p class="text-dim mt-3 max-w-xs text-sm">
          Une bibliothèque pour tout ce que tu regardes, joues, lis et écoutes.
          Gratuit, sans publicité, et le code est public.
        </p>
        <ul class="text-dim mt-5 flex flex-col gap-1.5 text-xs">
          <li class="flex items-center gap-2">
            <Icon name="shield" class="h-3.5 w-3.5 shrink-0" />
            AGPL-3.0 · aucun traceur publicitaire
          </li>
          <li class="flex items-center gap-2">
            <Icon name="download" class="h-3.5 w-3.5 shrink-0" />
            Export complet, suppression immédiate
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
      class="border-border text-dim mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-xs">
      <p>
        Développé et hébergé par une seule personne. Pas d'investisseur, donc
        rien à revendre.
      </p>
      <div
        class="border-border flex items-center gap-1 rounded-lg border p-0.5"
        role="group"
        aria-label="Langue">
        <span class="bg-surface-2 text-fg rounded-md px-2 py-1 font-mono">
          FR
        </span>
        <span class="px-2 py-1 font-mono">EN</span>
      </div>
    </div>
  </div>
</footer>
