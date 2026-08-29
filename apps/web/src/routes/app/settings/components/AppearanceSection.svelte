<script lang="ts">
  import { updateMe } from "$lib/api/auth";
  import { resolveApiError } from "$lib/api/errors";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PremiumLockBadge from "$lib/components/PremiumLockBadge.svelte";
  import ThemePreview from "$lib/components/ThemePreview.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { THEME_DEFINITIONS } from "$lib/constants/theme-definitions";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import type { MobileDestination } from "$lib/navigation";
  import {
    DEFAULT_BOTTOM_SHORTCUTS,
    resolveBottomShortcuts,
    resolveShortcutChoices,
  } from "$lib/navigation";
  import {
    NAV_STYLE_META,
    navStyle,
    type NavStyle,
  } from "$lib/navStyle.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { setLocale } from "$lib/paraglide/runtime.js";
  import { type Locale } from "@loomkeep/shared";
  import { dndzone } from "svelte-dnd-action";

  const navStyleLocked = $derived(
    liveFlags.isEnabled("premium-features") && !auth.isPremium,
  );

  const MIN = 3;
  const MAX = 7;

  const LOCALE_OPTIONS = [
    { label: m.common_language_fr(), value: "fr" },
    { label: m.common_language_en(), value: "en" },
  ];

  let error = $state("");
  let saving = $state(false);
  let localeSaving = $state(false);

  const gate = $derived({ isDomainEnabled, isAdmin: auth.isAdmin });

  // Stored order, gated to what's visible now (drops disabled/unknown ids and
  // keeps "menu"). This is the working set every action rebuilds from.
  const selected = $derived(
    resolveBottomShortcuts(
      auth.user?.mobileNavShortcuts?.length
        ? auth.user.mobileNavShortcuts
        : DEFAULT_BOTTOM_SHORTCUTS,
      gate,
    ),
  );
  const selectedIds = $derived(selected.map((d) => d.id));

  // Writable derived: mirrors `selected`, but svelte-dnd-action reassigns it
  // directly mid-drag; it resets to `selected` whenever that changes
  // underneath (e.g. after a save, or a domain being disabled elsewhere).
  let dragItems: MobileDestination[] = $derived(selected);

  // Pinnable destinations not already in the bar.
  const choices = $derived(
    resolveShortcutChoices(gate).filter((d) => !selectedIds.includes(d.id)),
  );

  const canRemove = $derived(selected.length > MIN);
  const canAdd = $derived(selected.length < MAX);

  async function save(next: string[]) {
    error = "";
    saving = true;
    try {
      await updateMe({ mobileNavShortcuts: next });
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      saving = false;
    }
  }

  // No error UI here: reload on success (setLocale's default) makes an
  // inline error dead on arrival anyway, and a failed save just leaves the
  // toggle showing the still-current (unsaved) locale.
  async function saveLocale(next: Locale) {
    if (localeSaving || auth.user?.locale === next) return;
    localeSaving = true;
    try {
      await updateMe({ locale: next });
      setLocale(next);
    } catch {
      localeSaving = false;
    }
  }

  function handleDndConsider(e: CustomEvent<{ items: MobileDestination[] }>) {
    dragItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: MobileDestination[] }>) {
    dragItems = e.detail.items;
    void save(dragItems.map((d) => d.id));
  }

  function remove(id: string) {
    if (!canRemove || id === "menu") return;
    void save(selectedIds.filter((x) => x !== id));
  }

  function add(id: string) {
    if (!canAdd) return;
    void save([...selectedIds, id]);
  }
</script>

<section class="card mb-5 space-y-4 p-5 md:p-6">
  <h2 class="font-display mb-1 text-lg font-bold">Apparence</h2>
  <p class="text-dim text-sm">Configure l'apparence de l'application.</p>

  <div>
    <p class="mb-2 font-semibold">Thème</p>
    <div class="flex gap-2">
      {#each THEME_DEFINITIONS as theme (theme.mode)}
        <ThemePreview {theme} />
      {/each}
    </div>
  </div>

  <div>
    <p class="mb-2 flex items-center gap-2 font-semibold">
      Style de navigation
      {#if isFeatureNew("nav-styles")}
        <NewBadge />
      {/if}
    </p>
    <p class="text-dim mb-3 text-sm">
      Change la mise en forme du rail et de la barre du bas. « Marquee » est
      inclus ; les deux autres sont réservés aux comptes premium.
    </p>
    <div class="grid gap-2 sm:grid-cols-3">
      {#each Object.entries(NAV_STYLE_META) as [id, meta] (id)}
        {@const locked = meta.premium && navStyleLocked}
        {#snippet styleButton()}
          <button
            type="button"
            disabled={locked}
            onclick={() => navStyle.set(id as NavStyle)}
            class="relative w-full rounded-xl border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 {navStyle.choice ===
            id
              ? 'border-accent bg-accent/10 text-fg'
              : 'text-dim hover:bg-surface-2 border-border'}">
            <span class="text-fg text-sm font-semibold">{meta.label}</span>
            <span class="text-dim mt-1 block text-xs">{meta.blurb}</span>
          </button>
        {/snippet}
        {#if locked}
          <Tooltip text={m.premium_locked()}>
            {@render styleButton()}
            <PremiumLockBadge />
          </Tooltip>
        {:else}
          {@render styleButton()}
        {/if}
      {/each}
    </div>
  </div>

  <div>
    <p class="mb-2 flex items-center gap-2 font-semibold">
      {m.common_language()}
      {#if isFeatureNew("locale-english")}
        <NewBadge />
      {/if}
    </p>
    <div
      class:pointer-events-none={localeSaving}
      class:opacity-50={localeSaving}>
      <Combobox
        label={m.common_language()}
        options={LOCALE_OPTIONS}
        values={[auth.user?.locale ?? "fr"]}
        onChange={(v) => saveLocale(v[0] as Locale)} />
    </div>
  </div>

  <div>
    <p class="mb-2 font-semibold">Barre de navigation mobile</p>
    <p class="text-dim text-sm">
      Choisis les raccourcis du bas de l'écran sur téléphone ({MIN} à {MAX}) et
      leur ordre. « Menu » reste toujours présent — c'est lui qui ouvre toutes
      les pages.
    </p>

    <ul
      class="divide-border divide-y"
      use:dndzone={{
        items: dragItems,
        dragDisabled: saving,
        flipDurationMs: 150,
      }}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}>
      {#each dragItems as item (item.id)}
        {@const locked = item.id === "menu"}
        <li class="flex items-center gap-3 py-2.5">
          <Icon name="grip" class="text-dim h-4 w-4 shrink-0 cursor-grab" />
          <Icon name={item.icon} class="text-accent h-5 w-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate font-semibold">
            {item.label}
            {#if locked}
              <span class="text-dim ml-1 text-xs font-normal"
                >· toujours affiché</span>
            {/if}
          </span>

          <button
            type="button"
            class="hover:bg-danger/10 hover:text-danger text-dim grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30"
            aria-label={m.common_remove()}
            disabled={saving || locked || !canRemove}
            title={locked
              ? "« Menu » ne peut pas être retiré."
              : !canRemove
                ? `Au moins ${MIN} raccourcis.`
                : undefined}
            onclick={() => remove(item.id)}>
            <Icon name="x" class="h-4 w-4" />
          </button>
        </li>
      {/each}
    </ul>

    {#if choices.length > 0}
      <div class="border-border border-t pt-4">
        <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
          Ajouter
        </p>
        <div class="flex flex-wrap gap-2">
          {#each choices as c (c.id)}
            <button
              type="button"
              class="chip inline-flex items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40"
              disabled={saving || !canAdd}
              title={!canAdd ? `Maximum ${MAX} raccourcis.` : undefined}
              onclick={() => add(c.id)}>
              <Icon name={c.icon} class="h-3.5 w-3.5" />
              {c.label}
            </button>
          {/each}
        </div>
        {#if !canAdd}
          <p class="text-dim mt-2 text-xs">
            Maximum atteint — retire un raccourci pour en ajouter un autre.
          </p>
        {/if}
      </div>
    {/if}

    {#if error}
      <p class="text-danger mt-3 text-sm">{error}</p>
    {/if}
  </div>
</section>
