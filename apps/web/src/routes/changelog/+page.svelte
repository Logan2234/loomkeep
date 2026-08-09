<script lang="ts">
  // Public release notes — reachable without login (see PUBLIC_ROUTES in the
  // root layout), linked from the "Loomkeep vX.Y.Z" footer on /settings and
  // /admin, and from the newsletter email (#v{version} anchors below).
  import { getChangelog } from "$lib/api/changelog";
  import { ApiError } from "$lib/api/core";
  import type { ChangelogEntryDto } from "@loomkeep/shared";

  let entries = $state<ChangelogEntryDto[] | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    getChangelog()
      .then((e) => (entries = e))
      .catch((e) => {
        error = e instanceof ApiError ? e.message : "Nouveautés indisponibles";
      })
      .finally(() => (loading = false));
  });

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
</script>

<svelte:head>
  <title>Nouveautés — Loomkeep</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-5 py-10 md:py-16">
  <header class="mb-12">
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Nouveautés
    </h1>
    <p class="text-dim mt-2">Ce qui a changé, version après version.</p>
  </header>

  {#if error}
    <p class="text-danger">{error}</p>
  {:else if loading}
    <div class="space-y-8">
      {#each { length: 3 } as _}
        <div class="skeleton h-28 w-full rounded-xl"></div>
      {/each}
    </div>
  {:else if entries && entries.length > 0}
    <ol class="divide-border divide-y">
      {#each entries as entry, i (entry.id)}
        <li
          id="v{entry.version}"
          class="scroll-mt-20 py-12 first:pt-0 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-10">
          <!-- The "stub": a ticket-style rail carrying the version/date, torn
               off from the programme notes by a dashed perforation — the
               vertical counterpart to the horizontal hairline between
               entries. -->
          <div
            class="sm:border-border mb-6 sm:mb-0 sm:border-r sm:border-dashed sm:pr-6">
            <p class="text-accent font-mono text-3xl leading-none font-bold">
              v{entry.version}
            </p>
            <p class="timecode mt-3 text-xs">
              {dateFmt.format(new Date(entry.publishedAt))}
            </p>
          </div>
          <div>
            <div class="mb-5 flex flex-wrap items-center gap-3">
              <h2 class="font-display text-xl font-bold">{entry.title}</h2>
              {#if i === 0}
                <span class="chip chip-on px-2.5 py-1 text-[11px]">
                  Dernière version
                </span>
              {/if}
            </div>
            <ul class="space-y-3.5">
              {#each entry.highlights as highlight}
                <li class="flex gap-2.5 text-[15px] leading-relaxed">
                  <span class="text-accent shrink-0" aria-hidden="true">▸</span>
                  <span>{highlight}</span>
                </li>
              {/each}
            </ul>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="text-dim">Rien à annoncer pour l'instant.</p>
  {/if}
</div>
