<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { adminFilterHref } from "#lib/admin-filter-url.js";
  import {
    getAdminAccountsStats,
    getAdminNewsletterSends,
  } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import { CHANGELOG_URL } from "#lib/constants/external-links.js";
  import {
    DATETIME_NUMERIC_OPTIONS,
    formatDateTime,
    formatNumber,
  } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import AdminFilterBar from "../AdminFilterBar.svelte";
  import AdminQueryError from "../AdminQueryError.svelte";
  import { filterNewsletterSends } from "./newsletter-filters";

  const sendsQuery = createApiQuery(() => ({
    key: keys.admin.newsletterSends(),
    fetch: getAdminNewsletterSends,
  }));
  const subscribersQuery = createApiQuery(() => ({
    key: keys.admin.accountsStats(),
    fetch: getAdminAccountsStats,
  }));
  const query = $derived(page.url.searchParams.get("q") ?? "");
  const from = $derived(page.url.searchParams.get("from") ?? "");
  const to = $derived(page.url.searchParams.get("to") ?? "");
  const sends = $derived(
    filterNewsletterSends(sendsQuery.data ?? [], { query, from, to }),
  );
  function update(updates: Record<string, string | null>) {
    void goto(adminFilterHref(page.url, updates), {
      replace: true,
      reset: false,
    });
  }
  function reset() {
    update({ q: null, from: null, to: null });
  }
  const active = $derived([
    ...(query ? [{ label: query, remove: () => update({ q: null }) }] : []),
    ...(from
      ? [
          {
            label: `${m.admin_date_from()} ${from}`,
            remove: () => update({ from: null }),
          },
        ]
      : []),
    ...(to
      ? [
          {
            label: `${m.admin_date_to()} ${to}`,
            remove: () => update({ to: null }),
          },
        ]
      : []),
  ]);
</script>

<PageHeader
  icon="sparkles"
  title={m.common_newsletter()}
  subtitle={m.admin_newsletter_history()}
  back="/app/admin">
</PageHeader>
<div class="card mb-5 space-y-4 p-5">
  <p class="text-dim text-sm">{m.admin_newsletter_help()}</p>
  <div class="flex flex-wrap items-center gap-3">
    <a class="btn btn-ghost" href="/app/admin/users?newsletter=yes">
      {subscribersQuery.loading
        ? m.common_loading()
        : subscribersQuery.data
          ? m.admin_newsletter_subscribers({
              count: formatNumber(subscribersQuery.data.health.withNewsletter),
            })
          : m.common_unavailable()}
    </a>
    <a
      class="btn btn-ghost"
      href="/app/admin/communications?tab=email&template=newsletter"
      >{m.admin_newsletter_template()}</a>
  </div>
  {#if subscribersQuery.error}<AdminQueryError
      message={subscribersQuery.error}
      queryKey={keys.admin.accountsStats()} />{/if}
</div>
<AdminFilterBar
  count={sends.length}
  loading={sendsQuery.loading}
  error={!!sendsQuery.error}
  {active}
  onReset={reset}>
  <input
    type="search"
    value={query}
    aria-label={m.common_search()}
    placeholder={m.common_search()}
    class="input min-w-0 flex-1"
    oninput={(event) => update({ q: event.currentTarget.value || null })} />
  <label class="text-dim flex items-center gap-2 text-sm"
    >{m.admin_date_from()}<input
      type="date"
      value={from}
      max={to || undefined}
      class="input"
      onchange={(event) =>
        update({ from: event.currentTarget.value || null })} /></label>
  <label class="text-dim flex items-center gap-2 text-sm"
    >{m.admin_date_to()}<input
      type="date"
      value={to}
      min={from || undefined}
      class="input"
      onchange={(event) =>
        update({ to: event.currentTarget.value || null })} /></label>
</AdminFilterBar>
<section class="card p-5 md:p-6">
  <h2 class="font-display mb-3 text-lg font-bold">{m.admin_sends()}</h2>
  {#if sendsQuery.error}<AdminQueryError
      message={sendsQuery.error}
      queryKey={keys.admin.newsletterSends()} />
  {:else if sendsQuery.loading}<div
      aria-label={m.common_loading()}
      class="space-y-2">
      {#each { length: 3 } as _, i (i)}<div class="skeleton h-14 rounded-lg">
        </div>{/each}
    </div>
  {:else if sends.length}
    <ul class="divide-border divide-y">
      {#each sends as send (send.id)}
        <li class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="text-fg text-sm font-semibold break-words">
              {send.title}
            </p>
            <p class="timecode mt-1 text-xs">
              {formatDateTime(send.sentAt, DATETIME_NUMERIC_OPTIONS)} · {send.recipientCount ===
              1
                ? m.admin_recipient_count_one({ count: send.recipientCount })
                : m.admin_recipient_count_many({ count: send.recipientCount })}
            </p>
          </div>
          <a
            class="btn btn-ghost btn-sm"
            href={`${CHANGELOG_URL}/${encodeURIComponent(send.quackbackChangelogId)}`}
            target="_blank"
            rel="noopener noreferrer"
            >{m.admin_changelog_open()}<span class="sr-only">
              — {send.title}</span
            ></a>
        </li>
      {/each}
    </ul>
  {:else}<EmptyState
      ><p>
        {active.length ? m.admin_no_matches() : m.admin_newsletter_empty()}
      </p>
      {#if active.length}<button class="btn btn-ghost mt-3" onclick={reset}
          >{m.admin_filters_reset()}</button
        >{:else}<a
          class="btn btn-ghost mt-3"
          href={CHANGELOG_URL}
          target="_blank"
          rel="noopener noreferrer">{m.admin_changelog_open()}</a
        >{/if}</EmptyState
    >{/if}
</section>
