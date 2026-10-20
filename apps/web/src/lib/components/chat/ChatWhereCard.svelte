<script lang="ts">
  import { getMessageWhere } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Poster from "#lib/components/Poster.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import type { MessageWorkDto, WatchOfferKind } from "@loomkeep/shared";
  import { workKindLabel } from "./conversation-presentation";

  let { messageId, work }: { messageId: string; work: MessageWorkDto } =
    $props();

  // Read live, in the viewer's region, with the platforms members share now.
  const whereQuery = createApiQuery(() => ({
    key: keys.chat.messageWhere(messageId),
    fetch: () => getMessageWhere(messageId),
  }));
  const where = $derived(whereQuery.data);
  // Past six, the card would outgrow the conversation: the rest is on
  // JustWatch's page.
  const SHOWN = 6;
  const offers = $derived(where?.offers.slice(0, SHOWN) ?? []);
  const best = $derived(offers.findIndex((offer) => offer.members.length > 0));

  const KIND: Record<WatchOfferKind, () => string> = {
    flatrate: m.ownership_subscription,
    free: m.media_free,
    ads: m.media_with_ads,
    rent: m.media_rent,
    buy: m.media_buy,
  };
</script>

<!-- Every platform with the work, and on each the faces of who has it. -->
<div
  class="border-border bg-surface text-fg flex w-80 max-w-full flex-col gap-2 rounded-2xl border p-3">
  <a
    href={work.href}
    class="text-fg hover:text-accent flex items-center gap-2.5 no-underline transition-colors duration-150"
    onclick={() => chat.close()}>
    <span class="w-10 shrink-0 overflow-hidden rounded-md">
      <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
    </span>
    <span class="min-w-0">
      <span class="font-display block truncate leading-tight font-extrabold">
        {work.title}
      </span>
      <span class="text-dim text-xs">
        {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
      </span>
    </span>
  </a>

  {#if where}
    {#if where.offers.length === 0}
      <p class="text-dim text-sm">{m.chat_where_none()}</p>
    {/if}
    {#each offers as offer, i (`${offer.kind}:${offer.provider.id}`)}
      <div
        class="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2 py-1.5
          {offer.members.length > 0 ? 'bg-surface-2' : ''}
          {i === best ? 'shadow-[inset_3px_0_0_var(--accent)]' : ''}
          {offer.members.length === 0 && offer.kind === 'flatrate'
          ? 'opacity-60'
          : ''}">
        {#if offer.provider.logoUrl}
          <img
            src={offer.provider.logoUrl}
            alt=""
            class="h-7 w-7 rounded-lg object-cover" />
        {:else}
          <span class="bg-surface-2 h-7 w-7 rounded-lg"></span>
        {/if}
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold"
            >{offer.provider.name}</span>
          <span class="text-dim block text-xs">{KIND[offer.kind]()}</span>
        </span>
        <span class="flex gap-0.5">
          {#each offer.members as member (member.id)}
            <span class="flex" title={member.displayName}>
              <Avatar seed={member.username} url={member.avatarUrl} size={22} />
            </span>
          {/each}
        </span>
      </div>
    {/each}
    {#if where.link && where.offers.length > SHOWN}
      <a
        href={where.link}
        target="_blank"
        rel="noopener noreferrer"
        class="text-accent self-start text-xs font-semibold no-underline hover:underline">
        {m.media_watch_offers_link()}
      </a>
    {/if}
    {#if where.link}
      <a
        href={where.link}
        target="_blank"
        rel="noopener noreferrer"
        class="text-dim hover:text-fg self-start font-mono text-[0.65rem] no-underline transition-colors duration-150">
        {m.media_watch_attribution({ region: where.region })}
      </a>
    {/if}
  {:else}
    <div class="bg-surface-2 h-10 animate-pulse rounded-xl"></div>
    <div class="bg-surface-2 h-10 animate-pulse rounded-xl"></div>
  {/if}
</div>
