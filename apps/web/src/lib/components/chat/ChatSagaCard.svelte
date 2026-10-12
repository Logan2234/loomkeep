<script lang="ts">
  import { getMessageSaga } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SagaStep } from "@loomkeep/shared";

  let { messageId }: { messageId: string } = $props();

  // Read live: every member's progress moves on after the message is sent.
  const sagaQuery = createApiQuery(() => ({
    key: keys.chat.messageSaga(messageId),
    fetch: () => getMessageSaga(messageId),
  }));
  const saga = $derived(sagaQuery.data);
  const columns = $derived(
    `4.75rem repeat(${saga?.works.length ?? 1}, minmax(0, 1fr)) 2rem`,
  );

  const STEP_CLASS: Record<SagaStep, string> = {
    done: "bg-accent",
    active:
      "bg-[linear-gradient(90deg,var(--accent)_50%,var(--surface-2)_50%)]",
    none: "bg-surface-2",
  };
</script>

<!-- The works in order, then one progress row per member. -->
<div
  class="border-border bg-surface text-fg flex w-80 max-w-full flex-col gap-2.5 rounded-2xl border p-3">
  {#if saga}
    <div>
      <p class="font-display text-[1.05rem] leading-tight font-extrabold">
        {saga.title}
      </p>
      <p class="text-dim text-xs">
        {DOMAINS[saga.domain].label} · {m.chat_saga_order({
          count: saga.works.length,
        })}
      </p>
    </div>
    <div class="grid items-end gap-1" style:grid-template-columns={columns}>
      <span></span>
      {#each saga.works as work, i (i)}
        {#if work.href}
          <a
            href={work.href}
            class="block overflow-hidden rounded-md transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:ring-2 hover:ring-[var(--accent)] motion-reduce:transition-none
              {work.upcoming ? 'opacity-50' : ''}"
            aria-label={m.chat_saga_open({ title: work.title })}
            title={work.title}
            onclick={() => chat.close()}>
            <Poster
              src={work.imageUrl}
              title={work.title}
              alt=""
              caption={false} />
          </a>
        {:else}
          <span class="overflow-hidden rounded-md" title={work.title}>
            <Poster src={work.imageUrl} title={work.title} caption={false} />
          </span>
        {/if}
      {/each}
      <span></span>
    </div>
    {#each saga.members as member (member.user.id)}
      {@const done = member.steps.filter((step) => step === "done").length}
      <div
        class="grid items-center gap-1"
        style:grid-template-columns={columns}>
        <span class="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <Avatar
            seed={member.user.username}
            url={member.user.avatarUrl}
            size={20} />
          <span class="truncate">
            {member.mine ? m.common_you() : member.user.displayName}
          </span>
        </span>
        {#each member.steps as step, i (i)}
          <i class="block h-1.5 rounded-full {STEP_CLASS[step]}"></i>
        {/each}
        <span class="text-dim text-right font-mono text-[0.7rem] font-bold">
          {done}/{member.steps.length}
        </span>
      </div>
    {/each}
  {:else}
    <div class="bg-surface-2 h-4 w-2/3 animate-pulse rounded"></div>
    <div class="bg-surface-2 h-16 animate-pulse rounded"></div>
  {/if}
</div>
