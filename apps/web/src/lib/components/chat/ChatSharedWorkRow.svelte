<script lang="ts">
  // One line of "Œuvres partagées": the work, who shared it and when, and
  // whether the viewer tracks it.
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import { addWorkToLibrary, workDomain } from "#lib/chat/work-library.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import Tooltip from "#lib/components/Tooltip.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled } from "#lib/domains.js";
  import { formatDate } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ConversationWorkDto } from "@loomkeep/shared";
  import { workKindLabel } from "./conversation-presentation";

  let { work, peerName }: { work: ConversationWorkDto; peerName: string } =
    $props();

  const domain = $derived(workDomain(work.kind));
  // A domain the viewer turned off has no page to open.
  const available = $derived(isDomainEnabled(domain));

  let added = $state(false);
  const tracked = $derived(work.inLibrary || added);
  const addMut = createApiMutation(() => ({
    mutate: () => addWorkToLibrary(work),
    onSuccess: () => (added = true),
    successToast: m.chat_work_added({ title: work.title }),
    errorToast: true,
  }));
</script>

{#snippet line()}
  <span class="w-[38px] shrink-0 overflow-hidden rounded-[5px]">
    <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
  </span>
  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="truncate font-semibold">{work.title}</span>
    <span
      class="text-accent font-mono text-[0.62rem] font-bold tracking-wider uppercase">
      {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
    </span>
  </span>
{/snippet}

<li
  class="border-surface-2 flex items-center gap-2 border-b py-1.5 last:border-b-0">
  {#if available}
    <a
      href={work.href}
      class="hover:bg-surface-2 text-fg -mx-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 no-underline transition-colors duration-150"
      onclick={() => chat.close()}>
      {@render line()}
    </a>
  {:else}
    <span class="flex min-w-0 flex-1 items-center gap-3 py-1 opacity-70">
      {@render line()}
    </span>
  {/if}

  <span class="text-dim shrink-0 font-mono text-[0.66rem] tabular-nums">
    {work.mine ? m.common_you() : peerName} · {formatDate(work.sharedAt, {
      day: "2-digit",
      month: "2-digit",
    })}
  </span>

  {#if !available}
    <Tooltip text={m.chat_work_domain_off({ domain: DOMAINS[domain].label })}>
      <span
        class="text-warning grid h-7 w-7 place-items-center"
        role="img"
        aria-label={m.chat_work_domain_off({ domain: DOMAINS[domain].label })}>
        <Icon name="warning" class="h-4 w-4" />
      </span>
    </Tooltip>
  {:else if tracked}
    <span
      class="bg-accent text-accent-fg grid h-7 w-7 shrink-0 place-items-center rounded-full"
      role="img"
      aria-label={m.chat_work_in_library()}
      title={m.chat_work_in_library()}>
      <Icon name="check" class="h-3.5 w-3.5" />
    </span>
  {:else}
    <button
      type="button"
      class="border-border text-dim hover:border-accent hover:text-accent grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors duration-150"
      aria-label={m.chat_work_add({ title: work.title })}
      title={m.chat_work_add({ title: work.title })}
      disabled={addMut.loading}
      onclick={() => addMut.mutate()}>
      <Icon name="plus" class="h-3.5 w-3.5" />
    </button>
  {/if}
</li>
