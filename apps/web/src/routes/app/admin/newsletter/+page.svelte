<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import { getAdminNewsletterSends } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { DATETIME_NUMERIC_OPTIONS, formatDateTime } from "$lib/format";

  const sendsQuery = createApiQuery(() => ({
    key: keys.admin.newsletterSends(),
    fetch: getAdminNewsletterSends,
  }));
  const sends = $derived(sendsQuery.data);
  const loading = $derived(sendsQuery.loading);
  const loadError = $derived(sendsQuery.error);
</script>

<div class="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="sparkles"
    title={m.common_newsletter()}
    subtitle={m.admin_newsletter_subtitle()} />

  <section class="card p-5 md:p-6">
    <h2 class="font-display mb-3 text-lg font-bold">{m.admin_sends()}</h2>

    {#if loadError}
      <Banner variant="error">{loadError}</Banner>
    {:else if loading}
      <div class="space-y-2">
        {#each { length: 3 } as _, i (i)}
          <div class="skeleton h-14 rounded-lg"></div>
        {/each}
      </div>
    {:else if sends && sends.length > 0}
      <ul
        class="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {#each sends as send (send.id)}
          <li class="flex items-center gap-3 px-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-fg truncate text-sm font-semibold">
                {send.title}
              </p>
              <p class="timecode text-xs">
                {formatDateTime(send.sentAt, DATETIME_NUMERIC_OPTIONS)} ·
                {send.recipientCount === 1
                  ? m.admin_recipient_count_one({ count: send.recipientCount })
                  : m.admin_recipient_count_many({
                      count: send.recipientCount,
                    })}
              </p>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-dim py-6 text-center text-sm">
        {m.admin_newsletter_empty()}
      </p>
    {/if}
  </section>
</div>
