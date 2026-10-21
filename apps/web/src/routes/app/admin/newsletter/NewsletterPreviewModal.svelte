<script lang="ts">
  import { getAdminNewsletterPreview } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import Modal from "#lib/components/Modal.svelte";
  import { CHANGELOG_URL } from "#lib/constants/external-links.js";
  import { DATETIME_NUMERIC_OPTIONS, formatDateTime } from "#lib/format.js";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import type { NewsletterSendDto } from "@loomkeep/shared";
  import AdminQueryError from "../AdminQueryError.svelte";

  let { send, onclose }: { send: NewsletterSendDto; onclose: () => void } =
    $props();

  const locale = getLocale();
  const previewQuery = createApiQuery(() => ({
    key: keys.admin.newsletterPreview(send.id, locale),
    fetch: () => getAdminNewsletterPreview(send.id, locale),
  }));
</script>

<Modal
  title={send.title}
  eyebrow={`${formatDateTime(send.sentAt, DATETIME_NUMERIC_OPTIONS)} · ${
    send.recipientCount === 1
      ? m.admin_recipient_count_one({ count: send.recipientCount })
      : m.admin_recipient_count_many({ count: send.recipientCount })
  }`}
  wide
  {onclose}>
  <div class="flex flex-col gap-3">
    {#if previewQuery.error}
      <AdminQueryError
        message={previewQuery.error}
        queryKey={keys.admin.newsletterPreview(send.id, locale)} />
    {:else if previewQuery.data}
      <div class="border-border bg-surface-2 overflow-hidden rounded-xl border">
        <iframe
          title={m.admin_newsletter_preview_title({ title: send.title })}
          sandbox=""
          srcdoc={previewQuery.data.html}
          class="block h-130 w-full border-0 bg-white"></iframe>
      </div>
    {:else}
      <div class="skeleton h-130 rounded-xl" aria-label={m.common_loading()}>
      </div>
    {/if}
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-dim text-xs">{m.admin_newsletter_preview_note()}</p>
      <a
        class="link-accent text-sm font-semibold"
        href={`${CHANGELOG_URL}/${encodeURIComponent(send.quackbackChangelogId)}`}
        target="_blank"
        rel="noopener noreferrer">{m.admin_changelog_open()}</a>
    </div>
  </div>
</Modal>
