<script lang="ts">
  // A widget's own settings, beyond its size and place. Edits a copy: the
  // layout only changes on "Appliquer", and the page itself only once the
  // editor saves.
  import Combobox from "$lib/components/Combobox.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { DEFAULT_QUICK_LINKS } from "$lib/home/quick-links";
  import { HOME_WIDGETS } from "$lib/home/widgets";
  import { m } from "$lib/paraglide/messages.js";
  import {
    HOME_LAYOUT_LIMITS,
    type HomeWidgetConfigDto,
    type HomeWidgetDto,
    type HomeWidgetSort,
    type HomeWidgetType,
    type LeaderboardPeriod,
    type LeaderboardScope,
    type MediaType,
  } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import DomainsConfig from "./config/DomainsConfig.svelte";
  import ListContentConfig from "./config/ListContentConfig.svelte";
  import QuickLinksConfig from "./config/QuickLinksConfig.svelte";

  let {
    widget,
    onapply,
    onclose,
  }: {
    widget: HomeWidgetDto;
    onapply: (config: HomeWidgetConfigDto) => void;
    onclose: () => void;
  } = $props();

  const def = $derived(HOME_WIDGETS[widget.type]);
  const stored = untrack(() => widget.config ?? {});
  let links = $state(stored.links ?? DEFAULT_QUICK_LINKS);
  let listId = $state(stored.listId);
  let text = $state(stored.text ?? "");
  let domains = $state(stored.domains ?? []);
  let mediaTypes = $state<MediaType[]>(stored.mediaTypes ?? []);
  let scope = $state<LeaderboardScope>(stored.scope ?? "friends");
  let period = $state<LeaderboardPeriod>(stored.period ?? "month");
  let sort = $state<HomeWidgetSort>(
    stored.sort ?? untrack(() => def.sorts?.[0] ?? "recent"),
  );
  let ownOnly = $state(stored.ownOnly ?? false);

  // What each kind keeps of the form: only the fields it reads.
  const CONFIG_OF: Partial<Record<HomeWidgetType, () => HomeWidgetConfigDto>> =
    {
      quickLinks: () => ({ links }),
      note: () => ({ text }),
      listContent: () => ({ listId }),
      activity: () => ({ domains }),
      favorites: () => ({ domains }),
      toWatch: () => ({ mediaTypes }),
      tonightPick: () => ({ mediaTypes }),
      friendsPodium: () => ({ scope, period }),
      myLists: () => ({ sort, ownOnly }),
      gamesPlaying: () => ({ sort }),
      booksReading: () => ({ sort }),
      musicToListen: () => ({ sort }),
    };

  function apply() {
    onapply(CONFIG_OF[widget.type]?.() ?? {});
    onclose();
  }

  const MEDIA_TYPES: { value: MediaType; label: string }[] = [
    { value: "MOVIE", label: m.media_movies() },
    { value: "SERIES", label: m.media_series_plural() },
    { value: "ANIME", label: m.media_anime() },
  ];
  const SCOPES: { value: LeaderboardScope; label: string }[] = [
    { value: "friends", label: m.gamification_leaderboard_tab_friends() },
    { value: "global", label: m.gamification_leaderboard_tab_global() },
  ];
  const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
    { value: "month", label: m.gamification_leaderboard_period_month() },
    { value: "year", label: m.gamification_leaderboard_period_year() },
    { value: "all", label: m.gamification_leaderboard_period_all() },
  ];
  const LIST_SCOPES: { value: "all" | "own"; label: string }[] = [
    { value: "all", label: m.home_config_lists_all() },
    { value: "own", label: m.home_config_lists_own() },
  ];

  // Lists sort by their own dates; works by when they were added, and
  // "progress" is a game's playtime or a book's page.
  const SORT_LABELS = $derived<Partial<Record<HomeWidgetSort, () => string>>>(
    widget.type === "myLists"
      ? {
          recent: m.lists_sort_updated,
          created: m.lists_sort_created,
          size: m.lists_sort_count,
          title: m.common_name,
        }
      : {
          recent: m.library_sort_added,
          title: m.common_title,
          progress:
            widget.type === "gamesPlaying"
              ? m.game_playtime
              : m.book_reading_progress,
        },
  );
  const sorts = $derived(
    (def.sorts ?? []).map((value) => ({
      value,
      label: SORT_LABELS[value]?.() ?? value,
    })),
  );
</script>

{#snippet legend(text: string)}
  <p class="text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
    {text}
  </p>
{/snippet}

<Modal
  title={m.home_editor_configure_title({ name: def.title() })}
  wide
  {onclose}>
  <div class="space-y-5">
    {#if widget.type === "quickLinks"}
      <QuickLinksConfig bind:links />
    {:else if widget.type === "listContent"}
      <ListContentConfig bind:listId />
    {:else if widget.type === "activity" || widget.type === "favorites"}
      <DomainsConfig bind:domains />
    {:else if widget.type === "toWatch" || widget.type === "tonightPick"}
      <Combobox
        label={m.home_config_media_types_legend()}
        multiselect
        options={MEDIA_TYPES}
        values={mediaTypes}
        onChange={(values) => (mediaTypes = values as MediaType[])} />
    {:else if widget.type === "friendsPodium"}
      <div>
        {@render legend(m.home_config_scope_legend())}
        <SegmentedControl
          label={m.home_config_scope_legend()}
          options={SCOPES}
          value={scope}
          onChange={(v) => (scope = v)} />
      </div>
      <div>
        {@render legend(m.home_config_period_legend())}
        <SegmentedControl
          label={m.home_config_period_legend()}
          options={PERIODS}
          value={period}
          onChange={(v) => (period = v)} />
      </div>
    {:else if widget.type === "note"}
      <label class="block">
        <span class="sr-only">{def.title()}</span>
        <textarea
          class="input min-h-40 resize-y"
          name="note"
          maxlength={HOME_LAYOUT_LIMITS.noteLength}
          placeholder={m.home_note_placeholder()}
          bind:value={text}></textarea>
      </label>
      <p class="timecode -mt-3.5 text-right text-[0.65rem]">
        {text.length} / {HOME_LAYOUT_LIMITS.noteLength}
      </p>
    {/if}
    {#if sorts.length > 0}
      <div>
        {@render legend(m.common_sort_by())}
        <!-- Four orders don't fit side by side on a phone. -->
        <SegmentedControl
          label={m.common_sort_by()}
          options={sorts}
          value={sort}
          onChange={(v) => (sort = v)}
          class="max-w-full flex-wrap" />
      </div>
    {/if}
    <!-- Sharing a list with editors is a social feature. -->
    {#if widget.type === "myLists" && appConfig.socialEnabled}
      <div>
        {@render legend(m.lists_title())}
        <SegmentedControl
          label={m.lists_title()}
          options={LIST_SCOPES}
          value={ownOnly ? "own" : "all"}
          onChange={(v) => (ownOnly = v === "own")}
          class="max-w-full flex-wrap" />
      </div>
    {/if}
  </div>
  {#snippet actions()}
    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn-ghost" onclick={onclose}>
        {m.common_cancel()}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        disabled={widget.type === "listContent" && !listId}
        onclick={apply}>
        {m.common_apply()}
      </button>
    </div>
  {/snippet}
</Modal>
