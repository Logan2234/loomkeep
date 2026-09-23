<script lang="ts">
  import type {
    getAdminUserComments,
    getAdminUserFollowers,
    getAdminUserFollowing,
    getAdminUserLists,
    getAdminUserReportsAgainst,
    getAdminUserReviews,
  } from "$lib/api/admin";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import {
    REPORT_CATEGORY_LABELS,
    REPORT_MOTIF_LABELS,
    REPORT_STATUS_COLORS,
    REPORT_STATUS_LABELS,
  } from "$lib/constants/report-labels";
  import { formatDate } from "$lib/format";
  import { m } from "$lib/paraglide/messages.js";

  type ActivityKind =
    "reviews" | "comments" | "followers" | "following" | "lists" | "reports";

  let {
    kind,
    loading,
    error,
    reviews,
    comments,
    followers,
    following,
    lists,
    reportsAgainst,
    onRetry,
    onClose,
  }: {
    kind: ActivityKind;
    loading: boolean;
    error: string | null;
    reviews: Awaited<ReturnType<typeof getAdminUserReviews>>;
    comments: Awaited<ReturnType<typeof getAdminUserComments>>;
    followers: Awaited<ReturnType<typeof getAdminUserFollowers>>;
    following: Awaited<ReturnType<typeof getAdminUserFollowing>>;
    lists: Awaited<ReturnType<typeof getAdminUserLists>>;
    reportsAgainst: Awaited<ReturnType<typeof getAdminUserReportsAgainst>>;
    onRetry: () => void;
    onClose: () => void;
  } = $props();
</script>

{#snippet queryState()}
  {#if loading}
    <div class="space-y-2" aria-label={m.common_loading()}>
      <div class="skeleton h-16 rounded-lg"></div>
      <div class="skeleton h-16 rounded-lg"></div>
    </div>
  {:else if error}
    <Banner variant="error">
      <div class="flex items-center justify-between gap-3">
        <span>{error}</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick={onRetry}>
          {m.common_retry()}
        </button>
      </div>
    </Banner>
  {/if}
{/snippet}

{#snippet emptyState(empty: boolean)}
  {#if !loading && !error && empty}
    <p class="text-dim py-4 text-center text-sm">{m.common_no_results()}.</p>
  {/if}
{/snippet}

{#if kind === "reviews"}
  <Modal title={m.admin_users_reviews()} onclose={onClose}>
    {@render queryState()}
    {@render emptyState(reviews.length === 0)}
    {#if !loading && !error && reviews.length > 0}<ul class="space-y-2">
        {#each reviews as r (r.id)}
          <li class="border-border rounded-lg border p-3 text-sm">
            {#if r.target?.href}
              <a href={r.target.href} class="font-semibold hover:underline"
                >{r.target.title}</a>
            {:else}
              <span class="font-semibold"
                >{r.target?.title ?? m.admin_users_deleted_work()}</span>
            {/if}
            <span class="text-dim ml-2 text-xs">{r.rating}/10</span>
            {#if r.text}
              <p class="text-dim mt-1 line-clamp-2 text-xs">{r.text}</p>
            {/if}
          </li>
        {/each}
      </ul>{/if}
  </Modal>
{:else if kind === "comments"}
  <Modal title={m.common_comments()} onclose={onClose}>
    {@render queryState()}
    {@render emptyState(comments.length === 0)}
    {#if !loading && !error && comments.length > 0}<ul class="space-y-2">
        {#each comments as c (c.id)}
          <li class="border-border rounded-lg border p-3 text-sm">
            {#if c.href}
              <a href={c.href} class="hover:underline">{c.excerpt}</a>
            {:else}
              <p>{c.excerpt}</p>
            {/if}
            <p class="text-dim mt-1 text-xs">
              {formatDate(c.createdAt)}
            </p>
          </li>
        {/each}
      </ul>{/if}
  </Modal>
{:else if kind === "followers" || kind === "following"}
  <Modal
    title={kind === "followers"
      ? m.profile_connections_followers_title()
      : m.profile_connections_following_title()}
    onclose={onClose}>
    {@render queryState()}
    {@render emptyState(
      (kind === "followers" ? followers : following).length === 0,
    )}
    {#if !loading && !error && (kind === "followers" ? followers : following).length > 0}<ul
        class="space-y-1">
        {#each kind === "followers" ? followers : following as u (u.id)}
          <li>
            <a
              href="/app/u/{u.username}"
              class="hover:bg-surface-2 flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar seed={u.username} url={u.avatarUrl} size={36} />
              <span class="min-w-0">
                <span class="text-fg block truncate text-sm font-semibold"
                  >{u.displayName}</span>
                <span class="text-dim block truncate text-xs"
                  >@{u.username}</span>
              </span>
            </a>
          </li>
        {/each}
      </ul>{/if}
  </Modal>
{:else if kind === "lists"}
  <Modal title={m.common_lists()} onclose={onClose}>
    {@render queryState()}
    {@render emptyState(lists.length === 0)}
    {#if !loading && !error && lists.length > 0}<ul class="space-y-2">
        {#each lists as l (l.id)}
          <li class="border-border rounded-lg border p-3 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-fg font-semibold">{l.title}</span>
              <span class="text-dim text-xs"
                >· {l.itemCount} {m.admin_items_suffix()}</span>
              {#if l.role === "EDITOR"}
                <span class="text-dim text-xs"
                  >{m.admin_users_invited_by()} {l.author.displayName}</span>
              {/if}
            </div>
            <p class="text-dim mt-0.5 text-xs">
              {l.kind} · {l.visibility}
            </p>
          </li>
        {/each}
      </ul>{/if}
  </Modal>
{:else if kind === "reports"}
  <Modal title={m.admin_users_reports_received()} onclose={onClose}>
    {@render queryState()}
    {@render emptyState(reportsAgainst.length === 0)}
    {#if !loading && !error && reportsAgainst.length > 0}<ul class="space-y-2">
        {#each reportsAgainst as r (r.id)}
          <li class="border-border rounded-lg border p-3 text-sm">
            <div class="flex items-center gap-2">
              <span
                class="rounded-full border px-2 py-0.5 text-xs font-bold {REPORT_STATUS_COLORS[
                  r.status
                ]}">{REPORT_STATUS_LABELS[r.status]}</span>
              <span class="text-dim ml-auto text-xs"
                >{formatDate(r.createdAt)}</span>
            </div>
            {#if r.target}
              {#if r.target.href}
                <a href={r.target.href} class="mt-1.5 block hover:underline"
                  >{r.target.label}</a>
              {:else}
                <p class="mt-1.5">{r.target.label}</p>
              {/if}
            {/if}
            {#if r.category}
              <p class="text-dim mt-1 text-xs">
                {REPORT_CATEGORY_LABELS[r.category]}
                {#if r.motif}· {REPORT_MOTIF_LABELS[r.motif]}{/if}
              </p>
            {/if}
            {#if r.reason}
              <p class="text-dim mt-1 text-xs">« {r.reason} »</p>
            {/if}
          </li>
        {/each}
      </ul>{/if}
  </Modal>
{/if}
