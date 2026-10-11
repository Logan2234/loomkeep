<script lang="ts">
  import { chat } from "#lib/chat/chat.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessagePickDto, MessageWorkDto } from "@loomkeep/shared";

  let { pick, work }: { pick: MessagePickDto; work: MessageWorkDto } = $props();

  const among = $derived(
    pick.shared
      ? pick.count === 1
        ? m.chat_pick_shared_one({ count: pick.count })
        : m.chat_pick_shared_many({ count: pick.count })
      : pick.count === 1
        ? m.chat_pick_among_one({ count: pick.count })
        : m.chat_pick_among_many({ count: pick.count }),
  );
</script>

<!-- What the draw landed on, and what it was drawn among. -->
<a
  href={work.href}
  class="border-border bg-surface text-fg hover:border-accent grid w-72 max-w-full grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-2.5 no-underline transition-[border-color,transform] duration-150 hover:-translate-y-px motion-reduce:transition-none"
  onclick={() => chat.close()}>
  <span class="overflow-hidden rounded-md">
    <Poster src={work.imageUrl} title={work.title} alt="" />
  </span>
  <span class="flex min-w-0 flex-col gap-1">
    <span
      class="flex items-center gap-1 text-xs font-bold"
      style:color={DOMAINS[pick.domain].accent}>
      <Icon name={DOMAINS[pick.domain].icon} class="h-3.5 w-3.5" />
      {DOMAINS[pick.domain].label}
    </span>
    <span
      class="font-display line-clamp-2 text-[1.05rem] leading-tight font-extrabold">
      {work.title}
    </span>
    <span class="text-dim text-xs">{among}</span>
  </span>
</a>
