<script lang="ts">
  import {
    getAdminInvitations,
    renewAdminInvitation,
    revokeAdminInvitation,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    AdminInvitationDto,
    AdminInvitationLinkDto,
    AdminInvitationStatus,
    PagedResult,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";

  let {
    onInvite,
    onRenewed,
  }: {
    onInvite: () => void;
    /** A fresh link was minted — the page shows it in the invite modal. */
    onRenewed: (link: AdminInvitationLinkDto) => void;
  } = $props();

  const reduced = prefersReducedMotion();
  let revoking = $state<AdminInvitationDto | null>(null);

  const invitationsQuery = createApiInfiniteQuery<
    PagedResult<AdminInvitationDto>,
    number,
    AdminInvitationDto
  >(() => ({
    key: keys.admin.invitations(),
    fetch: (page) => getAdminInvitations({ page }),
    getPageItems: (page) => page.items,
    initialPageParam: 1,
    getNextPageParam: (last, allPages) =>
      last.hasMore ? allPages.length + 1 : undefined,
  }));
  const invitations = $derived(invitationsQuery.data);

  const renewMut = createApiMutation(() => ({
    mutate: renewAdminInvitation,
    invalidates: [keys.admin.invitations()],
    errorToast: true,
    onSuccess: (link) => onRenewed(link),
  }));

  const revokeMut = createApiMutation(() => ({
    mutate: revokeAdminInvitation,
    invalidates: [keys.admin.invitations()],
    errorToast: true,
    successToast: m.admin_invitations_revoked_toast(),
    onSuccess: () => (revoking = null),
  }));

  const STATUS: Record<
    AdminInvitationStatus,
    { label: () => string; pill: string; dot: string }
  > = {
    pending: {
      label: m.common_pending,
      pill: "border-accent/40 bg-accent/10 text-accent",
      dot: "bg-accent/15 text-accent",
    },
    used: {
      label: m.admin_invitations_status_used,
      pill: "border-success/40 bg-success/10 text-success",
      dot: "bg-success/15 text-success",
    },
    expired: {
      label: m.admin_invitations_status_expired,
      pill: "border-border text-dim",
      dot: "bg-surface-2 text-dim",
    },
    revoked: {
      label: m.admin_invitations_status_revoked,
      pill: "border-danger/40 bg-danger/10 text-danger",
      dot: "bg-surface-2 text-dim",
    },
  };

  function dateLine(invitation: AdminInvitationDto): string | null {
    if (invitation.status === "revoked" && invitation.revokedAt) {
      return m.admin_invitations_revoked_on({
        date: formatDate(invitation.revokedAt),
      });
    }
    if (invitation.status === "expired") {
      return m.admin_invitations_expired_on({
        date: formatDate(invitation.expiresAt),
      });
    }
    if (invitation.status === "pending") {
      return m.admin_invitations_expires_on({
        date: formatDate(invitation.expiresAt),
      });
    }
    return null;
  }

  function detailParts(invitation: AdminInvitationDto): string[] {
    const parts: string[] = [];
    if (invitation.maxUses > 1) {
      parts.push(
        m.admin_invitations_places_used({
          used: invitation.useCount,
          max: invitation.maxUses,
        }),
      );
    }
    const dates = dateLine(invitation);
    if (dates) parts.push(dates);
    if (invitation.createdByName) {
      parts.push(
        m.admin_invitations_created_by({ name: invitation.createdByName }),
      );
    }
    return parts;
  }

  const renewable = (invitation: AdminInvitationDto) =>
    invitation.status === "pending" || invitation.status === "expired";
</script>

{#if invitationsQuery.error}
  <div transition:fade={{ duration: reduced ? 0 : 120 }}>
    <Banner variant="error">{invitationsQuery.error}</Banner>
  </div>
{:else if invitationsQuery.loading}
  <div
    transition:fade={{ duration: reduced ? 0 : 120 }}
    class="card h-48 {reduced ? '' : 'animate-pulse'}">
  </div>
{:else if invitations.length === 0}
  <div transition:fade={{ duration: reduced ? 0 : 120 }}>
    <EmptyState>
      <div
        class="bg-accent/10 text-accent mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full">
        <Icon name="send" class="h-5 w-5" />
      </div>
      <p class="font-display text-fg text-lg font-bold">
        {m.admin_invitations_empty_title()}
      </p>
      <p class="mx-auto mt-1 max-w-sm text-sm">
        {m.admin_invitations_empty_body()}
      </p>
      <button type="button" class="btn btn-primary mt-5" onclick={onInvite}>
        <Icon name="plus" class="h-4 w-4" />
        {m.admin_invitations_invite()}
      </button>
    </EmptyState>
  </div>
{:else}
  <ul
    transition:fade={{ duration: reduced ? 0 : 120 }}
    class="card divide-border divide-y">
    {#each invitations as invitation (invitation.id)}
      {@const status = STATUS[invitation.status]}
      <li
        animate:flip={{ duration: reduced ? 0 : 160 }}
        in:fade|global={{ duration: reduced ? 0 : 140 }}
        class="flex items-start gap-3 px-4 py-3.5 transition-opacity {invitation.status ===
          'revoked' || invitation.status === 'expired'
          ? 'opacity-75'
          : ''}">
        <span
          class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full {status.dot}">
          <Icon name={invitation.email ? "mail" : "link"} class="h-4 w-4" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-fg truncate font-semibold">
              {invitation.email ??
                invitation.label ??
                m.admin_invitations_shared_link()}
            </span>
            {#if invitation.email && invitation.label}
              <span class="text-dim truncate text-sm">
                · {invitation.label}
              </span>
            {/if}
            <span
              class="rounded-full border px-1.5 py-0.5 text-[0.6rem] font-bold uppercase {status.pill}">
              {status.label()}
            </span>
          </div>

          <p class="text-dim mt-0.5 flex flex-wrap gap-x-1.5 text-xs">
            {#each detailParts(invitation) as part, index (index)}
              <!-- Each separator rides with the part after it, so a wrapped
                   line never starts on a lone dot. -->
              <span class="tabular-nums">
                {#if index > 0}<span aria-hidden="true">·</span>{/if}
                {part}
              </span>
            {/each}
          </p>

          {#if invitation.redeemedBy.length > 0}
            <div
              class="mt-2 flex items-center gap-2"
              aria-label={m.admin_invitations_redeemed_by()}>
              <div class="flex -space-x-2">
                {#each invitation.redeemedBy.slice(0, 5) as user (user.id)}
                  <span
                    class="ring-surface rounded-full ring-2"
                    title={user.displayName}>
                    <Avatar
                      seed={user.username}
                      url={user.avatarUrl}
                      size={24} />
                  </span>
                {/each}
              </div>
              <span class="text-dim truncate text-xs">
                {invitation.redeemedBy
                  .map((user) => user.displayName)
                  .join(", ")}
              </span>
            </div>
          {/if}
        </div>

        {#if renewable(invitation)}
          <div
            class="flex shrink-0 items-center gap-1"
            role="group"
            aria-label={m.admin_invitations_actions()}>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              disabled={renewMut.loading}
              onclick={() => renewMut.mutate(invitation.id)}>
              <Icon
                name="refresh"
                class="h-3.5 w-3.5 {renewMut.loading &&
                renewMut.variables === invitation.id &&
                !reduced
                  ? 'animate-spin'
                  : ''}" />
              <span class="hidden sm:inline"
                >{m.admin_invitations_renew()}</span>
            </button>
            {#if invitation.status === "pending"}
              <button
                type="button"
                class="btn-icon hover:text-danger"
                aria-label={m.admin_invitations_revoke()}
                title={m.admin_invitations_revoke()}
                onclick={() => (revoking = invitation)}>
                <Icon name="x" class="h-4 w-4" />
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if invitationsQuery.hasNextPage}
    <button
      transition:fade={{ duration: reduced ? 0 : 120 }}
      class="btn btn-ghost mt-4 w-full"
      disabled={invitationsQuery.isFetchingNextPage}
      onclick={() => invitationsQuery.fetchNextPage()}>
      {invitationsQuery.isFetchingNextPage
        ? m.common_loading()
        : m.common_load_more()}
    </button>
  {/if}
{/if}

{#if revoking}
  <ConfirmationModal
    title={m.admin_invitations_revoke_title()}
    message={m.admin_invitations_revoke_message()}
    confirmLabel={m.admin_invitations_revoke()}
    danger
    busy={revokeMut.loading}
    onConfirm={() => revoking && revokeMut.mutate(revoking.id)}
    onCancel={() => (revoking = null)} />
{/if}
