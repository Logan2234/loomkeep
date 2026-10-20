<script lang="ts">
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { findWorks } from "#lib/chat/work-search.js";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageWorkDto, MessageWorkKind } from "@loomkeep/shared";
  import ChatPicker from "./ChatPicker.svelte";
  import { workKindLabel } from "./conversation-presentation";

  let {
    query,
    onpick,
    oncancel,
    holdsEnter = true,
    kinds,
  }: {
    /** What follows `/reco ` or `#`. */
    query: string;
    onpick: (work: MessageWorkDto) => void;
    oncancel: () => void;
    /**
     * Enter with nothing to pick still belongs to the picker: `/reco …` is no
     * message to send. A `#` that matches nothing is just text, though.
     */
    holdsEnter?: boolean;
    /** Only these kinds of works (`/where`: films and series). */
    kinds?: readonly MessageWorkKind[];
  } = $props();

  const MIN_LENGTH = 2;

  let searched = $state("");
  let picker = $state<{ handleKey: (event: KeyboardEvent) => boolean } | null>(
    null,
  );

  $effect(() => {
    const next = query.trim();
    const timer = setTimeout(() => (searched = next), 300);
    return () => clearTimeout(timer);
  });

  // What the instance knows answers at once; the catalogues' fuller answer
  // takes its place when it comes.
  const localQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "local"),
    fetch: () => findWorks(searched, "local"),
    enabled: searched.length >= MIN_LENGTH,
    keepPreviousData: true,
  }));
  const allQuery = createApiQuery(() => ({
    key: keys.search.works(searched, "all"),
    fetch: () => findWorks(searched, "all"),
    enabled: searched.length >= MIN_LENGTH,
  }));
  const works = $derived(
    searched.length >= MIN_LENGTH
      ? (allQuery.data ?? localQuery.data ?? []).filter(
          (work) => !kinds || kinds.includes(work.kind),
        )
      : [],
  );

  /** The composer's keys while the picker is open; true when handled here. */
  export function handleKey(event: KeyboardEvent): boolean {
    if (picker?.handleKey(event)) return true;
    return holdsEnter && event.key === "Enter";
  }
</script>

<ChatPicker
  bind:this={picker}
  items={works}
  key={(work) => work.href}
  label={m.common_works()}
  empty={searched.length < MIN_LENGTH
    ? m.chat_reco_prompt()
    : allQuery.loading
      ? m.common_loading()
      : m.common_no_results()}
  {onpick}
  {oncancel}>
  {#snippet row(work)}
    <span class="w-[26px] shrink-0 overflow-hidden rounded">
      <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
    </span>
    <span class="min-w-0">
      <span class="block truncate text-sm font-semibold">{work.title}</span>
      <span class="text-dim block font-mono text-[0.68rem] uppercase">
        {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
      </span>
    </span>
  {/snippet}
</ChatPicker>
