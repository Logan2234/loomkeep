<script lang="ts">
  // "Partager" on a work page, laid out like a phone's share sheet: friends
  // first (sent into their conversation), then the system share sheet, the
  // link and the QR code.
  import {
    getChatFriends,
    getConversations,
    recommendWork,
  } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { workKindLabel } from "#lib/components/chat/conversation-presentation.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    canShareNatively,
    shareWorkNatively,
    workUrl,
  } from "#lib/share-work.js";
  import { toast } from "#lib/toast.svelte.js";
  import {
    MESSAGE_TEXT_MAX_LENGTH,
    RECOMMEND_MAX_FRIENDS,
    type MessageWorkDto,
  } from "@loomkeep/shared";
  import { fade, scale, slide } from "svelte/transition";
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import Poster from "./Poster.svelte";

  let {
    work,
    sendable = true,
    onclose,
  }: {
    work: MessageWorkDto;
    /** False for an 18+ title: it never becomes a card in a conversation. */
    sendable?: boolean;
    onclose: () => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const url = $derived(workUrl(work.href));
  const withFriends = $derived(appConfig.chatEnabled && sendable);
  let picked = $state<string[]>([]);
  let note = $state("");
  let copied = $state(false);
  let qrOpen = $state(false);
  let qrSvg = $state("");

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(""),
    fetch: () => getChatFriends(""),
    enabled: withFriends,
  }));
  const conversationsQuery = createApiQuery(() => ({
    key: keys.chat.conversations(),
    fetch: () => getConversations(),
    enabled: withFriends,
  }));

  // The friends written to last come first, as on a phone's share sheet.
  const friends = $derived.by(() => {
    const recent = (conversationsQuery.data?.items ?? []).flatMap((c) =>
      c.peer ? [c.peer.id] : [],
    );
    const rank = (id: string) => {
      const index = recent.indexOf(id);
      return index === -1 ? recent.length : index;
    };
    return [...(friendsQuery.data ?? [])].sort(
      (a, b) => rank(a.id) - rank(b.id),
    );
  });

  const sendMut = createApiMutation(() => ({
    mutate: () =>
      recommendWork({
        work: work.href,
        usernames: picked,
        text: note.trim() || undefined,
      }),
    onSuccess: ({ sent }) => {
      toast.success(
        sent > 1
          ? m.chat_recommend_sent_many({ count: sent })
          : m.chat_recommend_sent_one(),
      );
      onclose();
    },
    invalidates: [keys.chat.conversations()],
    errorToast: true,
  }));

  function toggle(username: string) {
    picked = picked.includes(username)
      ? picked.filter((u) => u !== username)
      : picked.length < RECOMMEND_MAX_FRIENDS
        ? [...picked, username]
        : picked;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      toast.error(m.share_work_copy_failed());
    }
  }

  $effect(() => {
    if (!qrOpen || qrSvg) return;
    const target = url;
    let cancelled = false;
    void (async () => {
      const { default: QRCode } = await import("qrcode");
      const svg = await QRCode.toString(target, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      if (!cancelled) qrSvg = svg;
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

{#snippet row(
  icon: "share" | "link" | "check" | "qr-code",
  label: string,
  hint: string,
  onclick: () => void,
)}
  <button
    type="button"
    class="hover:bg-surface-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150"
    {onclick}>
    <span
      class="bg-surface-2 text-fg grid h-9 w-9 shrink-0 place-items-center rounded-xl">
      <Icon name={icon} class="h-4 w-4" />
    </span>
    <span class="min-w-0">
      <span class="block text-sm font-semibold">{label}</span>
      <span class="text-dim block truncate text-xs">{hint}</span>
    </span>
  </button>
{/snippet}

<Modal title={m.common_share()} {onclose}>
  <div class="flex flex-col gap-4">
    <div class="bg-surface-2 flex items-center gap-3 rounded-xl p-2">
      <span class="w-[34px] shrink-0 overflow-hidden rounded">
        <Poster src={work.imageUrl} title={work.title} alt="" caption={false} />
      </span>
      <span class="min-w-0">
        <span
          class="text-accent block font-mono text-[0.62rem] font-bold tracking-wider uppercase">
          {workKindLabel(work.kind)}{work.year ? ` · ${work.year}` : ""}
        </span>
        <span class="font-display block truncate font-extrabold"
          >{work.title}</span>
      </span>
    </div>

    {#if withFriends}
      <section class="flex flex-col gap-2">
        <p
          class="text-dim font-mono text-[0.62rem] font-bold tracking-widest uppercase">
          {m.share_work_send_to()}
        </p>
        <div
          role="group"
          aria-label={m.share_work_send_to()}
          class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {#each friends as friend (friend.id)}
            {@const selected = picked.includes(friend.username)}
            <button
              type="button"
              aria-pressed={selected}
              class="hover:bg-surface-2 flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition-colors duration-150"
              onclick={() => toggle(friend.username)}>
              <span
                class="relative rounded-full transition-shadow duration-150
                  {selected
                  ? 'ring-accent ring-offset-surface ring-2 ring-offset-2'
                  : ''}">
                <Avatar
                  seed={friend.username}
                  url={friend.avatarUrl}
                  size={44} />
                {#if selected}
                  <span
                    transition:scale={{
                      duration: reduced ? 0 : 150,
                      start: 0.6,
                    }}
                    class="bg-accent text-accent-fg ring-surface absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full ring-2">
                    <Icon name="check" class="h-3 w-3" />
                  </span>
                {/if}
              </span>
              <span class="w-full truncate text-center"
                >{friend.displayName}</span>
            </button>
          {:else}
            {#if !friendsQuery.loading}
              <p class="text-dim px-1 py-2 text-sm">{m.chat_no_friends()}</p>
            {/if}
          {/each}
        </div>

        {#if picked.length > 0}
          <div
            transition:slide={{ duration: reduced ? 0 : 200 }}
            class="flex flex-col gap-2">
            <label>
              <span class="sr-only">{m.chat_recommend_note()}</span>
              <textarea
                bind:value={note}
                rows="2"
                maxlength={MESSAGE_TEXT_MAX_LENGTH}
                class="input resize-none text-sm"
                placeholder={m.chat_recommend_note()}></textarea>
            </label>
            <button
              type="button"
              class="btn btn-primary"
              disabled={sendMut.loading}
              onclick={() => sendMut.mutate()}>
              <Icon name="send" class="h-4 w-4" />
              {picked.length > 1
                ? m.chat_recommend_send_many({ count: picked.length })
                : m.chat_recommend_send_one()}
            </button>
          </div>
        {/if}
      </section>
    {/if}

    <section class="-mx-2 flex flex-col">
      {#if canShareNatively()}
        {@render row(
          "share",
          m.share_work_via(),
          m.share_work_via_hint(),
          () => void shareWorkNatively(work.title, work.href),
        )}
      {/if}
      {@render row(
        copied ? "check" : "link",
        copied ? m.common_link_copied() : m.common_copy_link(),
        url.replace(/^https?:\/\//, ""),
        () => void copyLink(),
      )}
      {@render row(
        "qr-code",
        qrOpen ? m.share_work_qr_hide() : m.share_work_qr_show(),
        m.share_work_qr_hint(),
        () => (qrOpen = !qrOpen),
      )}
      {#if qrOpen}
        <div
          transition:slide={{ duration: reduced ? 0 : 200 }}
          class="flex justify-center pt-2">
          {#if qrSvg}
            <!-- White backing in both themes: the code needs the contrast. -->
            <div
              in:fade={{ duration: reduced ? 0 : 150 }}
              class="qr-frame rounded-xl bg-white p-3">
              <!-- svg is qrcode's own generated markup, not user input -->
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html qrSvg}
            </div>
          {:else}
            <div class="bg-surface-2 h-44 w-44 animate-pulse rounded-xl"></div>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</Modal>

<style>
  /* qrcode's SVG output has no intrinsic size beyond its viewBox — pin one. */
  .qr-frame :global(svg) {
    width: 160px;
    height: 160px;
  }
</style>
