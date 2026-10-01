<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import { formatDate, formatRelative } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import type { ApiKeyDto } from "@loomkeep/shared";
  import { expiryState } from "../api-key-form";
  import { slide } from "svelte/transition";
  import { scopeLabels } from "../resources";

  let {
    apiKey,
    onrevoke,
  }: { apiKey: ApiKeyDto; onrevoke: (key: ApiKeyDto) => void } = $props();

  const reduced = prefersReducedMotion();

  let open = $state(false);

  const status = $derived(expiryState(apiKey));
  const resources = $derived(scopeLabels(apiKey.scopes));
  const summary = $derived(
    resources.length > 2
      ? `${resources.slice(0, 2).join(", ")} +${resources.length - 2}`
      : resources.join(", "),
  );
  const expiry = $derived.by(() => {
    if (!apiKey.expiresAt) return m.settings_api_keys_never_expires();
    const date = formatDate(apiKey.expiresAt);
    return status === "expired"
      ? m.settings_api_keys_expired_on({ date })
      : m.settings_api_keys_expires_on({ date });
  });
  const used = $derived(
    apiKey.lastUsedAt
      ? m.settings_api_keys_used({ when: formatRelative(apiKey.lastUsedAt) })
      : m.settings_api_keys_never_used(),
  );
</script>

<div
  class="hover:bg-surface-2/60 transition-colors motion-reduce:transition-none">
  <button
    type="button"
    class="flex w-full items-center gap-4 px-4 py-3 text-left"
    aria-expanded={open}
    onclick={() => (open = !open)}>
    <Icon name="key" class="text-dim hidden h-5 w-5 shrink-0 sm:block" />
    <span class="grid min-w-0 flex-1">
      <span class="flex items-center gap-2 font-semibold">
        <span class="truncate">{apiKey.name}</span>
        {#if status === "expired"}
          <span
            class="border-danger text-danger shrink-0 rounded-full border px-2 text-xs font-semibold">
            {m.settings_api_keys_expired()}
          </span>
        {/if}
      </span>
      <span class="text-dim truncate text-sm">
        {summary} ·
        <span
          class:text-warning={status === "soon"}
          class:text-danger={status === "expired"}>{expiry}</span>
        · {used}
      </span>
    </span>
    <Icon
      name="chevron-right"
      class="text-dim h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none {open
        ? 'rotate-90'
        : ''}" />
  </button>

  {#if open}
    <div
      class="flex flex-col gap-3 px-4 pb-4 sm:pl-13"
      transition:slide={{ duration: reduced ? 0 : 180 }}>
      <dl
        class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt class="text-dim">{m.settings_api_keys_detail_key()}</dt>
        <dd class="font-mono text-xs leading-5">lk_…{apiKey.suffix}</dd>
        <dt class="text-dim">{m.settings_api_keys_detail_access()}</dt>
        <dd>
          {m.settings_api_keys_read_only({ resources: resources.join(", ") })}
        </dd>
        <dt class="text-dim">{m.settings_api_keys_detail_created()}</dt>
        <dd>{formatDate(apiKey.createdAt)}</dd>
        <dt class="text-dim">{m.settings_api_keys_detail_last_used()}</dt>
        <dd>
          {apiKey.lastUsedAt
            ? formatRelative(apiKey.lastUsedAt)
            : m.settings_api_keys_never_used()}
        </dd>
        {#if apiKey.lastUsedIp}
          <dt class="text-dim">{m.settings_api_keys_detail_last_ip()}</dt>
          <dd class="font-mono text-xs leading-5">{apiKey.lastUsedIp}</dd>
        {/if}
      </dl>
      <div>
        <button
          type="button"
          class="btn btn-ghost btn-sm text-danger"
          onclick={() => onrevoke(apiKey)}>
          {status === "expired"
            ? m.settings_api_keys_delete()
            : m.settings_api_keys_revoke()}
        </button>
      </div>
    </div>
  {/if}
</div>
