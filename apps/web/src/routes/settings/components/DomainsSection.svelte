<script lang="ts">
  import { ApiError, updateMe } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { Domain } from "@loomkeep/shared";

  // Content domains the user composes the app from. Podcasts and board games
  // have no screens yet (planned P3) — enabling them only reveals their
  // "Bientôt" placeholders across the nav, search, stats and imports.
  const DOMAINS: {
    id: Domain;
    label: string;
    desc: string;
    comingSoon?: boolean;
  }[] = [
    {
      id: Domain.MEDIA,
      label: "Vidéo",
      desc: "Films, séries et anime.",
    },
    { id: Domain.GAMES, label: "Jeux", desc: "Jeux vidéo." },
    {
      id: Domain.BOOKS,
      label: "Livres",
      desc: "Romans, BD, mangas.",
    },
    {
      id: Domain.MUSIC,
      label: "Musique",
      desc: "Albums.",
    },
    {
      id: Domain.PODCASTS,
      label: "Podcasts",
      desc: "Émissions et épisodes.",
      comingSoon: true,
    },
    {
      id: Domain.BOARDGAMES,
      label: "Jeux de société",
      desc: "Jeux de plateau.",
      comingSoon: true,
    },
  ];

  let domainsError = $state("");

  async function toggleDomain(id: Domain) {
    if (!auth.user) return;
    const current = auth.user.enabledDomains;
    const has = current.includes(id);
    if (has && current.length === 1) return; // keep at least one domain visible
    // Rebuild in canonical order so the stored list stays tidy.
    const next = DOMAINS.map((d) => d.id).filter((d) =>
      d === id ? !has : current.includes(d),
    );
    domainsError = "";
    try {
      await updateMe({ enabledDomains: next });
    } catch (err) {
      domainsError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-1 text-lg font-bold">Domaines</h2>
    <p class="text-dim mb-4 text-sm">
      Choisis les univers présents dans ton app. Ce que tu masques disparaît de
      la navigation.
    </p>
    <div class="divide-border divide-y">
      {#each DOMAINS as d (d.id)}
        {@const on = auth.user.enabledDomains.includes(d.id)}
        {@const isLast = on && auth.user.enabledDomains.length === 1}
        <div
          class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p class="flex items-center gap-2 font-semibold">
              {d.label}
              {#if d.comingSoon}
                <span
                  class="bg-surface-2 text-dim rounded-full px-2 py-0.5 text-[0.6rem] font-bold">
                  Bientôt
                </span>
              {/if}
            </p>
            <p class="text-dim text-sm">{d.desc}</p>
          </div>
          <span
            class="shrink-0"
            title={isLast
              ? "Au moins un domaine doit rester actif."
              : undefined}>
            <Switch
              label={d.label}
              checked={on}
              disabled={isLast}
              onChange={() => toggleDomain(d.id)} />
          </span>
        </div>
      {/each}
    </div>
    {#if domainsError}
      <p class="text-danger mt-2 text-sm">{domainsError}</p>
    {/if}
  </section>
{/if}
