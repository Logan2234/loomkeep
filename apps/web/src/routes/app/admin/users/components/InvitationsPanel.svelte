<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "$lib/admin-filter-url";
  import Combobox from "$lib/components/Combobox.svelte";
  import AdminFilterBar from "../../AdminFilterBar.svelte";
  import {
    getAdminInvitations,
    renewAdminInvitation,
    revokeAdminInvitation,
  } from "$lib/api/client";
  import { createApiInfiniteQuery } from "$lib/api/infinite-query.svelte";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import AdminQueryError from "../../AdminQueryError.svelte";
  import ConfirmationModal from "$lib/components/ConfirmationModal.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type {
    AdminInvitationDto,
    AdminInvitationLinkDto,
    AdminInvitationRedeemerDto,
    AdminInvitationStatus,
    PagedResult,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";

  let {
    onInvite,
    onRenewed,
    onOpenUser,
  }: {
    onInvite: () => void;
    /** A fresh link was minted — the page shows it in the invite modal. */
    onRenewed: (link: AdminInvitationLinkDto) => void;
    onOpenUser: (user: AdminInvitationRedeemerDto) => void;
  } = $props();

  const reduced = prefersReducedMotion();
  let revoking = $state<AdminInvitationDto | null>(null);
  let renewing = $state<AdminInvitationDto | null>(null);

  const query = $derived(page.url.searchParams.get("invitationQ") ?? "");
  const activeStatus = $derived(
    page.url.searchParams.get("invitationStatus") ?? "",
  );
  const queryKey = $derived(
    keys.admin.invitations({ query, status: activeStatus }),
  );
  function filter(updates: Record<string, string | null>) {
    void goto(adminFilterHref(page.url, updates), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }
  function resetFilters() {
    filter({ invitationQ: null, invitationStatus: null });
  }
  const activeFilters = $derived([
    ...(query
      ? [{ label: query, remove: () => filter({ invitationQ: null }) }]
      : []),
    ...(activeStatus && activeStatus in STATUS
      ? [
          {
            label: STATUS[activeStatus as AdminInvitationStatus].label(),
            remove: () => filter({ invitationStatus: null }),
          },
        ]
      : []),
  ]);

  const invitationsQuery = createApiInfiniteQuery<
    PagedResult<AdminInvitationDto>,
    number,
    AdminInvitationDto
  >(() => ({
    key: queryKey,
    fetch: (page) => getAdminInvitations({ page, query, status: activeStatus }),
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
    onSuccess: (link) => {
      renewing = null;
      onRenewed(link);
    },
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

<AdminFilterBar
  count={invitations.length}
  loading={invitationsQuery.loading}
  error={!!invitationsQuery.error}
  active={activeFilters}
  onReset={resetFilters}>
  <input
    class="input min-w-0 flex-1"
    type="search"
    aria-label={m.admin_invitations_search()}
    placeholder={m.admin_invitations_search()}
    value={query}
    oninput={(event) =>
      filter({ invitationQ: event.currentTarget.value || null })} />
  <Combobox
    label={m.admin_all_statuses()}
    values={activeStatus ? [activeStatus] : []}
    options={[
      { value: "", label: m.admin_all_statuses() },
      ...Object.entries(STATUS).map(([value, state]) => ({
        value,
        label: state.label(),
      })),
    ]}
    onChange={(values) => filter({ invitationStatus: values[0] || null })} />
</AdminFilterBar>
{#if invitationsQuery.error}
  <div transition:fade={{ duration: reduced ? 0 : 120 }}>
    <AdminQueryError message={invitationsQuery.error} {queryKey} />
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
        {activeFilters.length
          ? m.admin_no_matches()
          : m.admin_invitations_empty_title()}
      </p>
      <p class="mx-auto mt-1 max-w-sm text-sm">
        {activeFilters.length
          ? m.admin_invitations_filtered_empty()
          : m.admin_invitations_empty_body()}
      </p>
      {#if activeFilters.length}<button
          class="btn btn-ghost mt-5"
          onclick={resetFilters}>{m.admin_filters_reset()}</button
        >{:else}
        <button type="button" class="btn btn-primary mt-5" onclick={onInvite}>
          <Icon name="plus" class="h-4 w-4" />
          {m.admin_invitations_invite()}
        </button>{/if}
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
            <ul
              class="mt-2 flex flex-wrap items-center gap-1"
              aria-label={m.admin_invitations_redeemed_by()}>
              {#each invitation.redeemedBy as user (user.id)}
                <li>
                  <button
                    type="button"
                    class="text-dim hover:text-fg hover:bg-surface-2 inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold transition-colors"
                    onclick={() => onOpenUser(user)}>
                    <Avatar
                      seed={user.username}
                      url={user.avatarUrl}
                      size={20} />
                    {user.displayName}
                  </button>
                </li>
              {/each}
            </ul>
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
              aria-label={m.admin_invitations_renew()}
              title={m.admin_invitations_renew()}
              onclick={() => (renewing = invitation)}>
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
    message={m.admin_invitations_revoke_identified({
      invitation:
        revoking.email ?? revoking.label ?? m.admin_invitations_shared_link(),
    })}
    confirmLabel={m.admin_invitations_revoke()}
    danger
    busy={revokeMut.loading}
    onConfirm={() => revoking && revokeMut.mutate(revoking.id)}
    onCancel={() => (revoking = null)} />
{/if}

{#if renewing}
  <ConfirmationModal
    title={m.admin_invitations_renew_title()}
    message={m.admin_invitations_renew_warning() +
      (renewing.email
        ? " " + m.admin_invitations_renew_email({ email: renewing.email })
        : "")}
    confirmLabel={m.admin_invitations_renew()}
    busy={renewMut.loading}
    onConfirm={() => renewing && renewMut.mutate(renewing.id)}
    onCancel={() => (renewing = null)} />
{/if}
