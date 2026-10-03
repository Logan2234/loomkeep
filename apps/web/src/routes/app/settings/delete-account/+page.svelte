<script lang="ts">
  import SettingsSection from "../components/SettingsSection.svelte";

  import { goto } from "$app/navigation";
  import { deleteAccount, getAccountDeletionSummary } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import { toast } from "$lib/toast.svelte";
  import type {
    AccountDeletionAnonymizedCategory,
    AccountDeletionDeletedCategory,
    AccountDeletionKeptCategory,
  } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";

  const DELETED_LABELS: Record<AccountDeletionDeletedCategory, string> = {
    LIBRARY: m.settings_delete_account_library_media(),
    EPISODE_WATCHES: m.settings_delete_account_watch_history(),
    MOVIE_REWATCHES: m.settings_delete_account_movie_rewatches(),
    GAMES: m.settings_delete_account_games(),
    GAME_PLAYTHROUGHS: m.settings_delete_account_game_playthroughs(),
    GAME_SESSIONS: m.settings_delete_account_game_sessions(),
    BOOKS: m.settings_delete_account_books(),
    BOOK_READINGS: m.settings_delete_account_book_readings(),
    BOOK_SESSIONS: m.settings_delete_account_book_sessions(),
    READING_GOALS: m.settings_delete_account_reading_goals(),
    SESSION_TIMER: m.settings_delete_account_session_timer(),
    MUSIC: m.settings_delete_account_music(),
    LISTS: m.settings_delete_account_lists(),
    LIST_MEMBERSHIPS: m.settings_delete_account_list_memberships(),
    LIST_MUTES: m.settings_delete_account_list_mutes(),
    FOLLOWS: m.settings_delete_account_follows(),
    BLOCKS: m.settings_delete_account_blocks(),
    REACTIONS: m.settings_delete_account_reactions(),
    NOTIFICATIONS: m.common_notifications(),
    ACTIVITY: m.common_activity_feed(),
    PROGRESSION: m.settings_delete_account_progression(),
    SAVED_VIEWS: m.settings_delete_account_saved_views(),
    VISIBILITY_SETTINGS: m.settings_delete_account_visibility_settings(),
    DEVICES: m.settings_delete_account_devices(),
    API_KEYS: m.settings_delete_account_api_keys(),
    PASSKEYS: m.settings_delete_account_passkeys(),
    TWO_FACTOR: m.settings_delete_account_two_factor(),
    PUSH_SUBSCRIPTIONS: m.settings_delete_account_push_subscriptions(),
    PENDING_REQUESTS: m.settings_delete_account_pending_requests(),
    PREMIUM: m.settings_delete_account_premium(),
  };

  // The erased rows read better in three groups than in one list of thirty.
  const DELETED_GROUPS: {
    title: string;
    categories: AccountDeletionDeletedCategory[];
  }[] = [
    {
      title: m.settings_delete_account_group_library(),
      categories: [
        "LIBRARY",
        "EPISODE_WATCHES",
        "MOVIE_REWATCHES",
        "GAMES",
        "GAME_PLAYTHROUGHS",
        "GAME_SESSIONS",
        "BOOKS",
        "BOOK_READINGS",
        "BOOK_SESSIONS",
        "READING_GOALS",
        "SESSION_TIMER",
        "MUSIC",
      ],
    },
    {
      title: m.settings_delete_account_group_social(),
      categories: [
        "LISTS",
        "LIST_MEMBERSHIPS",
        "LIST_MUTES",
        "FOLLOWS",
        "BLOCKS",
        "REACTIONS",
        "NOTIFICATIONS",
        "ACTIVITY",
      ],
    },
    {
      title: m.settings_delete_account_group_account(),
      categories: [
        "PROGRESSION",
        "SAVED_VIEWS",
        "VISIBILITY_SETTINGS",
        "DEVICES",
        "API_KEYS",
        "PASSKEYS",
        "TWO_FACTOR",
        "PUSH_SUBSCRIPTIONS",
        "PENDING_REQUESTS",
        "PREMIUM",
      ],
    },
  ];

  const ANONYMIZED_LABELS: Record<AccountDeletionAnonymizedCategory, string> = {
    REVIEWS: m.settings_delete_account_reviews(),
    REVIEW_REVISIONS: m.settings_delete_account_review_revisions(),
    COMMENTS: m.common_comments(),
    LIST_ITEMS_ADDED: m.settings_delete_account_list_items_added(),
    REPORTS: m.settings_delete_account_reports(),
    IMPORTS: m.settings_delete_account_imports(),
  };

  const KEPT_LABELS: Record<AccountDeletionKeptCategory, string> = {
    SECURITY_EVENTS: m.settings_delete_account_security_events(),
    MODERATION_DECISIONS: m.settings_delete_account_moderation_decisions(),
    REMOVED_CONTENT_COPIES: m.settings_delete_account_removed_content_copies(),
  };

  type Step =
    "now" | "deleted" | "anonymized" | "transferred" | "kept" | "after";

  const reduced = prefersReducedMotion();

  let showModal = $state(false);
  let deletePasswordInput = $state("");
  // An accordion: every step starts closed, and opening one closes the other.
  let openStep = $state<Step | null>(null);

  const summaryQuery = createApiQuery(() => ({
    key: keys.account.deletionSummary(),
    fetch: getAccountDeletionSummary,
    enabled: showModal,
  }));
  const summary = $derived(summaryQuery.data);
  const summaryLoading = $derived(summaryQuery.loading);

  function openDeleteModal() {
    deletePasswordInput = "";
    openStep = null;
    deleteMut.reset();
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  function toggle(step: Step) {
    openStep = openStep === step ? null : step;
  }

  const deleteMut = createApiMutation(() => ({
    mutate: () => deleteAccount({ currentPassword: deletePasswordInput }),
    coveredFields: ["currentPassword"],
    onSuccess: () => {
      toast.success(m.settings_delete_account_success());
      void goto("/login");
    },
  }));
</script>

{#snippet counts(rows: { label: string; count: number }[])}
  <ul class="flex flex-col gap-1">
    {#each rows as row (row.label)}
      <li
        class="flex items-baseline justify-between gap-3 text-sm {row.count ===
        0
          ? 'text-dim/70'
          : ''}">
        <span>{row.label}</span>
        <span class="timecode text-xs tabular-nums">{row.count}</span>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet step(
  key: Step,
  label: string,
  title: string,
  tone: string,
  body: Snippet,
)}
  {@const isOpen = openStep === key}
  <li class="relative">
    <span
      class="bg-surface absolute top-3.5 -left-[1.35rem] h-2.5 w-2.5 rounded-full border-2 transition-colors {tone} {isOpen
        ? 'bg-current'
        : ''}"
      aria-hidden="true"></span>
    <button
      type="button"
      aria-expanded={isOpen}
      class="hover:bg-surface-2 flex w-full items-baseline gap-3 rounded-lg px-2 py-2 text-left transition-colors"
      onclick={() => toggle(key)}>
      <span
        class="timecode w-24 shrink-0 text-[0.65rem] tracking-wide uppercase {tone}">
        {label}
      </span>
      <span class="min-w-0 flex-1 text-sm font-semibold">{title}</span>
      <Icon
        name="chevron-right"
        class="text-dim h-4 w-4 shrink-0 self-center transition-transform {isOpen
          ? 'rotate-90'
          : ''}" />
    </button>
    {#if isOpen}
      <div
        class="px-2 pt-1 pb-3"
        transition:slide={{ duration: reduced ? 0 : 220 }}>
        {@render body()}
      </div>
    {/if}
  </li>
{/snippet}

{#snippet nowBody()}
  <p class="text-dim text-sm">
    {m.settings_delete_account_now_body({ count: summary?.sessions ?? 0 })}
  </p>
{/snippet}

{#snippet deletedBody()}
  <div class="flex flex-col gap-3">
    {#each DELETED_GROUPS as group (group.title)}
      <div>
        <p class="timecode text-micro mb-1 tracking-wide uppercase">
          {group.title}
        </p>
        {@render counts(
          (summary?.deleted ?? [])
            .filter((row) => group.categories.includes(row.category))
            .map((row) => ({
              label: DELETED_LABELS[row.category],
              count: row.count,
            })),
        )}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet anonymizedBody()}
  {@render counts(
    (summary?.anonymized ?? []).map((row) => ({
      label: ANONYMIZED_LABELS[row.category],
      count: row.count,
    })),
  )}
  <p class="bg-surface-2 mt-2 rounded-lg px-3 py-2 text-xs">
    {m.settings_delete_account_anonymized_preview({
      name: m.common_deleted_user(),
    })}
  </p>
{/snippet}

{#snippet transferredBody()}
  <ul class="space-y-1">
    {#each summary?.transferredLists ?? [] as list (list.title)}
      <li class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate">{list.title}</span>
        <span class="timecode shrink-0 text-xs">→ {list.newOwner}</span>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet keptBody()}
  {@render counts(
    (summary?.kept ?? []).map((row) => ({
      label: KEPT_LABELS[row.category],
      count: row.count,
    })),
  )}
  <p class="text-dim mt-2 text-xs">{m.settings_delete_account_backups()}</p>
{/snippet}

{#snippet afterBody()}
  <p class="text-dim text-sm">{m.settings_delete_account_after_body()}</p>
{/snippet}

<SettingsSection slug="delete-account">
  <section
    class="border-danger/50 bg-danger/5 overflow-hidden rounded-xl border">
    <div class="p-5 md:p-6">
      <h2 class="font-display text-danger text-lg font-bold">
        {m.settings_danger_zone_title()}
      </h2>
      <p class="text-dim mt-2 max-w-2xl text-sm">
        {m.settings_delete_account_modal_description()}
      </p>
    </div>
    <div class="border-danger/30 border-t px-5 py-4 md:px-6">
      <button class="btn btn-danger" onclick={openDeleteModal}>
        {m.settings_delete_account_button()}
      </button>
    </div>
  </section>

  {#if showModal}
    <Modal title={m.settings_delete_account_modal_title()} onclose={closeModal}>
      <form
        class="flex flex-col gap-4"
        onsubmit={(e) => {
          e.preventDefault();
          deleteMut.mutate();
        }}>
        <a
          href="/app/settings/export"
          class="border-accent/40 bg-accent/8 hover:bg-accent/14 flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors"
          onclick={closeModal}>
          <Icon name="download" class="text-accent h-5 w-5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold">
              {m.settings_delete_account_export_title()}
            </span>
            <span class="text-dim block text-xs">
              {m.settings_delete_account_export_body()}
            </span>
          </span>
          <Icon name="chevron-right" class="text-dim h-4 w-4 shrink-0" />
        </a>

        <div>
          <p class="mb-2 font-semibold">
            {m.settings_delete_account_timeline_title()}
          </p>
          {#if summaryLoading}
            <div class="space-y-2">
              {#each Array(4) as _, i (i)}
                <div class="skeleton h-9 w-full rounded-lg"></div>
              {/each}
            </div>
          {:else if !summary}
            <p class="text-dim text-sm">
              {m.settings_delete_account_details_unavailable()}
            </p>
          {:else}
            <ol class="border-border ml-3 flex flex-col border-l pl-4">
              {@render step(
                "now",
                m.settings_delete_account_step_now(),
                m.settings_delete_account_now_title(),
                "text-danger border-danger",
                nowBody,
              )}
              {@render step(
                "deleted",
                m.settings_delete_account_step_deleted(),
                m.settings_delete_account_deleted_title(),
                "text-danger border-danger",
                deletedBody,
              )}
              {@render step(
                "anonymized",
                m.settings_delete_account_step_anonymized(),
                m.settings_delete_account_anonymized_title(),
                "text-dim border-dim",
                anonymizedBody,
              )}
              {#if summary.transferredLists.length > 0}
                {@render step(
                  "transferred",
                  m.settings_delete_account_step_transferred(),
                  m.settings_delete_account_transferred_title({
                    count: summary.transferredLists.length,
                  }),
                  "text-accent border-accent",
                  transferredBody,
                )}
              {/if}
              {@render step(
                "kept",
                m.settings_delete_account_step_kept(),
                m.settings_delete_account_kept_title(),
                "text-dim border-dim",
                keptBody,
              )}
              {@render step(
                "after",
                m.settings_delete_account_step_after(),
                m.settings_delete_account_after_title(),
                "text-dim border-dim",
                afterBody,
              )}
            </ol>
          {/if}
        </div>

        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">
            {m.settings_delete_account_password_label()}
          </span>
          <PasswordInput
            name="currentPassword"
            autocomplete="current-password"
            enterkeyhint="done"
            minlength={1}
            required
            bind:value={deletePasswordInput} />
        </label>
        {#if deleteMut.error}
          <p class="text-danger text-sm">{deleteMut.error}</p>
        {/if}
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" onclick={closeModal}>
            {m.common_cancel()}
          </button>
          <button
            type="submit"
            class="btn btn-danger"
            disabled={deleteMut.loading || !deletePasswordInput}>
            {deleteMut.loading
              ? m.settings_delete_account_deleting()
              : m.settings_delete_account_confirm()}
          </button>
        </div>
      </form>
    </Modal>
  {/if}
</SettingsSection>
