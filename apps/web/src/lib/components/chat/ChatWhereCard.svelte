<script lang="ts">
  import { getMessageWhere } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import Avatar from "#lib/components/Avatar.svelte";
  import Modal from "#lib/components/Modal.svelte";
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
  // Past three, the card would take over the conversation: the rest opens in
  // a sheet. Platforms members share come first, so they are the ones shown.
  const SHOWN = 3;
  const sorted = $derived(
    (where?.offers ?? []).toSorted(
      (a, b) => b.members.length - a.members.length,
    ),
  );
  const offers = $derived(sorted.slice(0, SHOWN));
  const best = $derived(sorted.findIndex((offer) => offer.members.length > 0));
  let allOpen = $state(false);
  type Offer = (typeof sorted)[number];

  const KIND: Record<WatchOfferKind, () => string> = {
    flatrate: m.ownership_subscription,
    free: m.media_free,
    ads: m.media_with_ads,
    rent: m.media_rent,
    buy: m.media_buy,
  };
</script>

{#snippet offerRow(offer: Offer, highlighted: boolean)}
  <div
    class="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2 py-1.5
      {offer.members.length > 0 ? 'bg-surface-2' : ''}
      {highlighted ? 'shadow-[inset_3px_0_0_var(--accent)]' : ''}
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
{/snippet}

{#snippet attribution()}
  {#if where?.link}
    <a
      href={where.link}
      target="_blank"
      rel="noopener noreferrer"
      class="text-dim hover:text-fg text-micro self-start font-mono no-underline transition-colors duration-150">
      {m.media_watch_attribution({ region: where.region })}
    </a>
  {/if}
{/snippet}

<!-- The platforms with the work, and on each the faces of who has it. -->
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
      {@render offerRow(offer, i === best)}
    {/each}
    {#if sorted.length > SHOWN}
      <button
        type="button"
        class="text-accent relative self-start text-xs font-semibold transition-opacity after:absolute after:-inset-3 hover:underline active:opacity-70"
        onclick={() => (allOpen = true)}>
        {m.media_watch_offers_link()} ({sorted.length})
      </button>
    {:else}
      {@render attribution()}
    {/if}
  {:else}
    <div class="bg-surface-2 h-10 animate-pulse rounded-xl"></div>
    <div class="bg-surface-2 h-10 animate-pulse rounded-xl"></div>
  {/if}
</div>

{#if allOpen}
  <Modal title={work.title} halfOpen onclose={() => (allOpen = false)}>
    <div class="flex flex-col gap-2">
      {#each sorted as offer, i (`${offer.kind}:${offer.provider.id}`)}
        {@render offerRow(offer, i === best)}
      {/each}
      {@render attribution()}
    </div>
  </Modal>
{/if}
