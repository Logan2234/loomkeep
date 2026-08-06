<script lang="ts">
  import {
    analyzeImport,
    ApiError,
    commitImport,
    getImportJob,
    searchBooks,
    searchCatalog,
    searchGames,
  } from "$lib/api/client";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Poster from "$lib/components/Poster.svelte";
  import {
    BOOK_STATUS_LABELS,
    BOOK_STATUS_ORDER,
    GAME_STATUS_LABELS,
    GAME_STATUS_ORDER,
  } from "$lib/status-labels";
  import type {
    BookSummaryDto,
    GameSummaryDto,
    ImportJobDto,
    ImportMatch,
    ImportPlan,
    ImportPlanItem,
    ImportSourceDescriptor,
    MediaSummaryDto,
  } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  // `intro` holds the source-specific export instructions (markup, hence a
  // snippet rather than a config field); everything else comes from `descriptor`.
  let {
    descriptor,
    intro,
  }: { descriptor: ImportSourceDescriptor; intro?: Snippet } = $props();

  type Phase = "input" | "analyzing" | "review" | "committing" | "done";
  let phase = $state<Phase>("input");
  let error = $state<string | null>(null);
  let showOverwriteConfirm = $state(false);

  // --- Input step ---
  // The raw payload sent as-is to the source: CSV text, a base64 ZIP, or a Steam id.
  let inputValue = $state("");
  let fileName = $state("");
  let fileError = $state<string | null>(null);
  let dragOver = $state(false);
  const optionState = new SvelteMap<string, boolean>(
    (descriptor.options ?? []).map((o) => [o.key, o.default]),
  );

  // --- Job / plan ---
  let analyzeJobId = $state<string | null>(null);
  let job = $state<ImportJobDto | null>(null);
  let plan = $state<ImportPlan | null>(null);

  // --- Decisions (reactive collections, mutated in place) ---
  const included = new SvelteSet<string>();
  const statuses = new SvelteMap<string, string>();
  const picked = new SvelteMap<string, ImportMatch>();
  let overwrite = $state(false);

  // --- Per-item manual search ---
  let searchKey = $state<string | null>(null);
  let searchQuery = $state("");
  let searchResults = $state<ImportMatch[]>([]);
  let searching = $state(false);

  // --- Review-step filter ---
  // Shows only items still needing a manual match; toggled from the recap bar.
  let filterUnresolved = $state(false);

  // Per-item status options (books/games); media derives status server-side.
  const statusOptions = $derived(
    descriptor.domain === "books"
      ? BOOK_STATUS_ORDER.map((s) => ({
          value: s,
          label: BOOK_STATUS_LABELS[s],
        }))
      : descriptor.domain === "games"
        ? GAME_STATUS_ORDER.map((s) => ({
            value: s,
            label: GAME_STATUS_LABELS[s],
          }))
        : [],
  );

  const isFileInput = $derived(descriptor.input.type !== "steamId");
  const inputReady = $derived(inputValue.trim().length > 0);
  const selectedCount = $derived(included.size);

  // Live count of items still without a match — decreases as the user resolves
  // them manually, unlike `plan.counts.unresolved` which is frozen at analyze time.
  const unresolvedRemaining = $derived.by(() => {
    if (!plan) return 0;
    let n = 0;
    for (const g of plan.groups) {
      for (const it of g.items) if (!matchOf(it)) n++;
    }
    return n;
  });

  const progressPct = $derived.by(() => {
    if (!job || job.progress.total === 0) return 0;
    return Math.round((job.progress.done / job.progress.total) * 100);
  });

  function plural(n: number): string {
    return n > 1 ? descriptor.noun.many : descriptor.noun.one;
  }

  function msg(err: unknown, fallback: string): string {
    return err instanceof ApiError ? err.message : fallback;
  }

  function matchOf(item: ImportPlanItem): ImportMatch | null {
    return picked.get(item.key) ?? item.match;
  }

  // --- Input handling ---
  function readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error ?? new Error("read error"));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    fileError = null;
    error = null;
    inputValue = "";
    if (descriptor.input.type === "zip") {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        fileError = "Sélectionne une archive .zip.";
        return;
      }
      const b64 = await readBase64(file);
      // A real ZIP starts with PK\x03\x04 → base64 "UEsD".
      if (!b64.startsWith("UEsD")) {
        fileError = "Ce fichier ne ressemble pas à une archive .zip valide.";
        return;
      }
      inputValue = b64;
    } else {
      inputValue = await file.text();
    }
    fileName = file.name;
  }

  function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  // --- Analyze / commit ---
  async function analyze() {
    if (!inputReady) return;
    error = null;
    job = null;
    plan = null;
    phase = "analyzing";
    const options: Record<string, boolean> = {};
    for (const [k, v] of optionState) options[k] = v;
    try {
      const started = await analyzeImport(descriptor.id, {
        input: inputValue,
        options,
      });
      analyzeJobId = started.id;
      job = started;
      pollJob(started.id, "review");
    } catch (err) {
      error = msg(err, "Analyse impossible.");
      phase = "input";
    }
  }

  function pollJob(jobId: string, next: "review" | "done") {
    getImportJob(descriptor.id, jobId)
      .then((j) => {
        job = j;
        if (j.status === "running") {
          window.setTimeout(() => pollJob(jobId, next), 1000);
        } else if (j.status === "failed") {
          error = j.error ?? "Le traitement a échoué.";
          phase = next === "review" ? "input" : "review";
        } else if (next === "review" && j.plan) {
          plan = j.plan;
          initDecisions(j.plan);
          phase = "review";
        } else {
          phase = "done";
        }
      })
      .catch((err) => {
        error = msg(err, "Suivi du job impossible.");
      });
  }

  /** Pre-select the confidently-resolved items and their default status. */
  function initDecisions(p: ImportPlan) {
    included.clear();
    statuses.clear();
    picked.clear();
    for (const g of p.groups) {
      for (const it of g.items) {
        // Pre-check everything that can be imported (has an auto match); the
        // user unchecks what they don't want. Unmatched items stay off — their
        // checkbox is disabled until a manual match is picked.
        if (it.match) included.add(it.key);
        if (it.defaultStatus) statuses.set(it.key, it.defaultStatus);
      }
    }
  }

  function toggle(key: string) {
    if (included.has(key)) included.delete(key);
    else included.add(key);
  }

  function setAll(items: ImportPlanItem[], on: boolean) {
    for (const it of items) {
      // Only auto-include items that have a match (auto or manual).
      if (on && matchOf(it)) included.add(it.key);
      else if (!on) included.delete(it.key);
    }
  }

  function openSearch(item: ImportPlanItem) {
    searchKey = searchKey === item.key ? null : item.key;
    searchQuery = matchOf(item)?.title ?? item.sourceTitle;
    searchResults = [];
  }

  function mediaToMatch(m: MediaSummaryDto): ImportMatch {
    return {
      source: m.source,
      sourceId: m.sourceId,
      type: m.type,
      title: m.title,
      year: m.year,
      coverUrl: m.posterUrl,
    };
  }
  function bookToMatch(b: BookSummaryDto): ImportMatch {
    return {
      source: b.source,
      sourceId: b.sourceId,
      title: b.title,
      year: b.year,
      coverUrl: b.coverUrl,
    };
  }
  function gameToMatch(g: GameSummaryDto): ImportMatch {
    return {
      source: g.source,
      sourceId: g.sourceId,
      title: g.title,
      year: g.year,
      coverUrl: g.coverUrl,
    };
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      const q = searchQuery.trim();
      const domain = plan?.searchDomain ?? "media";
      if (domain === "books") {
        searchResults = (await searchBooks(q)).results.map(bookToMatch);
      } else if (domain === "games") {
        searchResults = (await searchGames(q)).results.map(gameToMatch);
      } else {
        searchResults = (await searchCatalog(q)).results.map(mediaToMatch);
      }
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function chooseMatch(key: string, match: ImportMatch) {
    picked.set(key, match);
    included.add(key);
    searchKey = null;
    searchQuery = "";
    searchResults = [];
  }

  function commit() {
    if (!analyzeJobId || !plan || selectedCount === 0) return;
    if (overwrite) {
      showOverwriteConfirm = true;
      return;
    }
    doCommit();
  }

  async function doCommit() {
    showOverwriteConfirm = false;
    if (!analyzeJobId || !plan || selectedCount === 0) return;
    error = null;
    phase = "committing";

    const statusesObj: Record<string, string> = {};
    for (const [k, v] of statuses) if (included.has(k)) statusesObj[k] = v;
    const overrides: Record<string, ImportMatch> = {};
    for (const [k, m] of picked) if (included.has(k)) overrides[k] = m;

    try {
      const started = await commitImport(descriptor.id, analyzeJobId, {
        include: [...included],
        statuses: statusesObj,
        overrides: Object.fromEntries(
          Object.entries(overrides).map(([k, m]) => [
            k,
            { source: m.source, sourceId: m.sourceId, type: m.type },
          ]),
        ),
        overwrite,
      });
      job = started;
      pollJob(started.id, "done");
    } catch (err) {
      error = msg(err, "Import impossible.");
      phase = "review";
    }
  }

  function reset() {
    phase = "input";
    error = null;
    inputValue = "";
    fileName = "";
    fileError = "";
    analyzeJobId = null;
    job = null;
    plan = null;
    included.clear();
    statuses.clear();
    picked.clear();
    overwrite = false;
    searchKey = null;
    searchQuery = "";
    searchResults = [];
    filterUnresolved = false;
  }
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/settings/import"
      class="text-dim hover:text-fg"
      aria-label="Retour">
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Import {descriptor.label}
    </h1>
  </div>

  {#if error}
    <Banner variant="error" class="mb-4">{error}</Banner>
  {/if}

  {#if phase === "input"}
    {#if intro}
      <div class="text-dim mb-6 max-w-xl text-sm">{@render intro()}</div>
    {/if}

    {#if isFileInput}
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors {dragOver ||
        inputValue
          ? 'border-accent bg-surface-2'
          : 'border-border hover:border-accent hover:bg-surface-2'}"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={onDrop}>
        <input
          type="file"
          accept={descriptor.input.accept}
          class="hidden"
          onchange={onFile} />
        {#if inputValue}
          <span class="font-semibold">📦 {fileName}</span>
          <span class="timecode text-sm">clique ou dépose pour changer</span>
        {:else}
          <span class="font-semibold">Dépose ton fichier ici</span>
          <span class="text-dim text-sm">ou clique pour parcourir</span>
        {/if}
      </label>
      {#if fileError}
        <p class="text-danger mt-3 text-sm">{fileError}</p>
      {/if}
    {:else}
      <input
        type="text"
        placeholder="76561198… ou steamcommunity.com/id/pseudo"
        bind:value={inputValue}
        onkeydown={(e) => e.key === "Enter" && analyze()}
        class="input w-full" />
    {/if}

    {#if descriptor.options}
      <div class="mt-4 flex flex-col gap-2">
        {#each descriptor.options as opt (opt.key)}
          <label class="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={optionState.get(opt.key)}
              onchange={(e) =>
                optionState.set(opt.key, e.currentTarget.checked)}
              class="accent-[var(--accent)]" />
            {opt.label}
          </label>
        {/each}
      </div>
    {/if}

    <div class="mt-5">
      <button class="btn btn-primary" disabled={!inputReady} onclick={analyze}>
        Analyser
      </button>
    </div>
  {:else if phase === "analyzing" || phase === "committing"}
    <section class="card p-5 md:p-6">
      <p class="mb-2 font-semibold">
        {phase === "analyzing" ? "Analyse en cours…" : "Import en cours…"}
      </p>
      <div class="bg-surface-2 h-2.5 overflow-hidden rounded-full">
        <div
          class="bg-accent h-full transition-[width]"
          style={`width: ${progressPct}%`}>
        </div>
      </div>
      {#if job}
        <p class="timecode mt-2 text-sm">
          {job.progress.done}/{job.progress.total}
        </p>
      {/if}
    </section>
  {:else if phase === "review" && plan}
    {#if plan.groups.length === 0}
      <div
        class="border-border text-dim mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
        Rien à importer dans cet export.
      </div>
    {:else if filterUnresolved && unresolvedRemaining === 0}
      <div
        class="border-border text-dim mt-2 mb-24 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        Tout est associé.
        <button
          type="button"
          class="text-accent font-medium hover:underline"
          onclick={() => (filterUnresolved = false)}>
          Afficher tout
        </button>
      </div>
    {:else}
      <div class="mb-24">
        {#each plan.groups as g, gi (g.id)}
          {@const visibleItems = filterUnresolved
            ? g.items.filter((it) => !matchOf(it))
            : g.items}
          {#if visibleItems.length > 0}
            {#if descriptor.collapsibleGroups}
              <details
                class="card mb-3 p-4"
                open={filterUnresolved || gi === 0}>
                <summary
                  class="font-display flex cursor-pointer items-center justify-between font-bold">
                  <span
                    >{g.label} ({visibleItems.length}{#if filterUnresolved}
                      / {g.items.length}{/if})</span>
                  <span class="flex gap-2 text-xs font-normal">
                    <button
                      class="chip"
                      onclick={(e) => {
                        e.preventDefault();
                        setAll(visibleItems, true);
                      }}>Tout</button>
                    <button
                      class="chip"
                      onclick={(e) => {
                        e.preventDefault();
                        setAll(visibleItems, false);
                      }}>Rien</button>
                  </span>
                </summary>
                {@render groupBody(visibleItems)}
              </details>
            {:else}
              <section class="card mb-3 p-4">
                <div
                  class="font-display flex items-center justify-between font-bold">
                  <span
                    >{g.label} ({visibleItems.length}{#if filterUnresolved}
                      / {g.items.length}{/if})</span>
                  <span class="flex gap-2 text-xs font-normal">
                    <button
                      class="chip"
                      onclick={() => setAll(visibleItems, true)}>Tout</button>
                    <button
                      class="chip"
                      onclick={() => setAll(visibleItems, false)}>Rien</button>
                  </span>
                </div>
                {@render groupBody(visibleItems)}
              </section>
            {/if}
          {/if}
        {/each}
      </div>
    {/if}

    <div
      class="border-border bg-surface sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)] z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border px-4 py-3 shadow-lg md:bottom-3">
      <p class="flex items-baseline gap-2">
        <span class="font-display text-xl font-extrabold tabular-nums"
          >{selectedCount}</span>
        <span class="text-dim text-sm">
          {plural(selectedCount)} à importer{#if unresolvedRemaining > 0}
            ·
            <button
              type="button"
              class="font-medium underline decoration-dotted underline-offset-2 {filterUnresolved
                ? 'text-accent'
                : 'text-danger hover:text-fg'}"
              onclick={() => (filterUnresolved = !filterUnresolved)}>
              {unresolvedRemaining} à associer
            </button>
          {/if}
        </span>
      </p>
      <div class="flex items-center gap-3">
        {#if descriptor.canOverrideData}
          <label
            class="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              bind:checked={overwrite}
              class="accent-[var(--danger)]" />
            Écraser mes données
          </label>
        {/if}
        <button
          class="btn btn-primary"
          disabled={selectedCount === 0}
          onclick={commit}>
          Importer
        </button>
      </div>
    </div>
  {:else if phase === "done" && job?.report}
    {@const r = job.report}
    <section class="card p-5 md:p-6">
      <div class="mb-4 flex items-center gap-3">
        <Icon name="check" class="text-success h-6 w-6" />
        <h2 class="font-display text-lg font-bold">Import terminé</h2>
        {#if r.overwrite}
          <span
            class="bg-danger/15 text-danger rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Données remplacées
          </span>
        {/if}
      </div>
      <div
        class="grid gap-3"
        style={`grid-template-columns: repeat(${Math.min(r.tiles.length, 3)}, minmax(0, 1fr))`}>
        {#each r.tiles as tile (tile.label)}
          <div class="border-border bg-bg rounded-lg border p-4">
            <p class="timecode text-xs uppercase">{tile.label}</p>
            <p class="font-display text-2xl font-bold">{tile.value}</p>
            {#if tile.sub}<p class="text-dim text-sm">{tile.sub}</p>{/if}
          </div>
        {/each}
      </div>
      <div class="mt-5 flex gap-2">
        <a href={descriptor.libraryHref} class="btn btn-primary"
          >Voir ma bibliothèque</a>
        <button class="btn btn-ghost" onclick={reset}>Nouvel import</button>
      </div>
    </section>
  {/if}
</div>

{#if showOverwriteConfirm}
  <ConfirmationModal
    title="Écraser tes données ?"
    message="Écraser supprimera définitivement ta bibliothèque et ton historique de ce domaine avant l’import. Cette action est irréversible."
    confirmLabel="Écraser et importer"
    danger
    onConfirm={doCommit}
    onCancel={() => (showOverwriteConfirm = false)} />
{/if}

{#snippet groupBody(items: ImportPlanItem[])}
  <ul class="divide-border mt-3 flex flex-col divide-y">
    {#each items as item (item.key)}
      {@const match = matchOf(item)}
      {@const on = included.has(item.key)}
      <li class="flex flex-col gap-2 py-2.5">
        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            class="accent-accent h-4 w-4 shrink-0"
            checked={on}
            disabled={!match}
            onchange={() => toggle(item.key)} />
          <div class="bg-surface-2 h-12 w-9 shrink-0 overflow-hidden rounded">
            {#if match?.coverUrl}
              <img
                src={match.coverUrl}
                alt=""
                loading="lazy"
                class="h-full w-full object-cover" />
            {/if}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">
              {match?.title ?? item.sourceTitle}
            </p>
            <p class="timecode truncate text-xs">
              {#if match && match.title !== item.sourceTitle}
                {item.sourceTitle} ·
              {/if}
              {#if item.subtitle}{item.subtitle}{/if}
              {#if item.alreadyInLibrary}
                · <span class="text-dim">déjà suivi</span>
              {/if}
            </p>
          </div>
          {#if descriptor.hasManualMatch}
            {#if match}
              <button class="chip text-xs" onclick={() => openSearch(item)}>
                Changer
              </button>
            {:else}
              <button
                class="chip text-danger text-xs"
                onclick={() => openSearch(item)}>
                Associer…
              </button>
            {/if}
          {/if}
          {#if statusOptions.length > 0}
            <select
              class="input h-8 w-auto shrink-0 py-0 text-xs"
              disabled={!on}
              value={statuses.get(item.key) ?? statusOptions[0].value}
              onchange={(e) => statuses.set(item.key, e.currentTarget.value)}>
              {#each statusOptions as s (s.value)}
                <option value={s.value}>{s.label}</option>
              {/each}
            </select>
          {/if}
        </div>

        {#if searchKey === item.key}
          <div class="border-border bg-bg rounded-lg border p-3">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
              class="mb-2 flex gap-2">
              <input
                class="input flex-1"
                placeholder="Rechercher le bon titre…"
                bind:value={searchQuery} />
              <button class="btn btn-primary" disabled={searching}>
                {searching ? "…" : "Chercher"}
              </button>
            </form>
            {#if searchResults.length > 0}
              <ul class="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {#each searchResults as r (`${r.source}:${r.sourceId}`)}
                  <li>
                    <button
                      class="hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                      onclick={() => chooseMatch(item.key, r)}>
                      <div class="h-10 w-7 shrink-0 overflow-hidden rounded">
                        <Poster src={r.coverUrl} title={r.title} />
                      </div>
                      <span class="min-w-0 flex-1 truncate">
                        {r.title}
                        {#if r.year}<span class="text-dim">
                            · {r.year}</span
                          >{/if}
                      </span>
                      {#if r.type}<span class="timecode text-xs">{r.type}</span
                        >{/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {:else if !searching}
              <p class="timecode text-xs">
                Lance une recherche pour choisir le bon titre.
              </p>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}
