<script lang="ts">
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import { addWorkToLibrary } from "#lib/chat/work-library.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled } from "#lib/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    Domain,
    type MessageWorkDto,
    type MessageWorkKind,
  } from "@loomkeep/shared";
  import { workKindLabel } from "./conversation-presentation";

  let { work }: { work: MessageWorkDto } = $props();

  const DOMAIN_OF: Record<MessageWorkKind, Domain> = {
    MOVIE: Domain.MEDIA,
    SERIES: Domain.MEDIA,
    ANIME: Domain.MEDIA,
    GAME: Domain.GAMES,
    BOOK: Domain.BOOKS,
    MUSIC: Domain.MUSIC,
  };

  const domain = $derived(DOMAIN_OF[work.kind]);
  // A domain the viewer turned off has no page to open.
  const available = $derived(isDomainEnabled(domain));

  // The card is a snapshot: once added here, it says so without a refetch.
  let added = $state(false);
  const tracked = $derived(work.inLibrary || added);
  const addMut = createApiMutation(() => ({
    mutate: () => addWorkToLibrary(work),
    onSuccess: () => (added = true),
    successToast: m.chat_work_added({ title: work.title }),
    errorToast: true,
  }));
</script>

{#snippet ticket()}
  <span class="w-[52px] shrink-0 overflow-hidden rounded-md">
    <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
  </span>
  <span
    class="border-border absolute top-1.5 bottom-1.5 left-[68px] border-l border-dashed"
    aria-hidden="true"></span>
  <span class="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5 pr-7 pl-1.5">
    <span
      class="text-accent font-mono text-[0.62rem] font-bold tracking-wider uppercase">
      {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
    </span>
    <span
      class="font-display line-clamp-2 text-[0.95rem] leading-tight font-extrabold">
      {work.title}
    </span>
    {#if available}
      <span
        class="text-accent mt-auto flex items-center gap-1 pt-1 text-xs font-semibold">
        {m.chat_work_open()}
        <Icon name="arrow-right" class="h-3.5 w-3.5" />
      </span>
    {/if}
  </span>
{/snippet}

<!-- A ticket stub: the poster, a perforation, then what it is. -->
{#if available}
  <div class="relative w-64 max-w-full">
    <a
      href={work.href}
      class="border-border bg-surface text-fg hover:border-accent relative flex items-stretch gap-3 rounded-xl border p-2 no-underline transition-[border-color,transform] duration-150 hover:-translate-y-px motion-reduce:transition-none"
      onclick={() => chat.close()}>
      {@render ticket()}
    </a>
    <!-- Beside the link, not in it: a button can't sit inside an <a>. -->
    {#if tracked}
      <span
        class="bg-surface-2 text-accent absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full"
        role="img"
        aria-label={m.chat_work_in_library()}
        title={m.chat_work_in_library()}>
        <Icon name="check" class="h-3.5 w-3.5" />
      </span>
    {:else}
      <button
        type="button"
        class="border-border bg-surface text-dim hover:border-accent hover:text-accent absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full border transition-colors duration-150"
        aria-label={m.chat_work_add({ title: work.title })}
        title={m.chat_work_add({ title: work.title })}
        disabled={addMut.loading}
        onclick={() => addMut.mutate()}>
        <Icon name="plus" class="h-3.5 w-3.5" />
      </button>
    {/if}
  </div>
{:else}
  <div
    class="border-border bg-surface text-fg relative flex w-64 max-w-full items-stretch gap-3 rounded-xl border p-2 opacity-80">
    {@render ticket()}
    <Tooltip
      text={m.chat_work_domain_off({ domain: DOMAINS[domain].label })}
      class="absolute top-1.5 right-1.5">
      <span
        class="text-warning grid h-6 w-6 place-items-center"
        role="img"
        aria-label={m.chat_work_domain_off({ domain: DOMAINS[domain].label })}>
        <Icon name="warning" class="h-4 w-4" />
      </span>
    </Tooltip>
  </div>
{/if}
