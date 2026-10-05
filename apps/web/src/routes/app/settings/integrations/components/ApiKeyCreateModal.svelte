<script lang="ts">
  import { API_URL, createApiKey } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import AnimatedHeight from "$lib/components/AnimatedHeight.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import FieldError from "$lib/components/FieldError.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { DOCS_URL } from "$lib/constants/external-links";
  import { m } from "$lib/paraglide/messages.js";
  import {
    API_KEY_NAME_MAX_LENGTH,
    API_KEY_RESOURCES,
    type ApiKeyResource,
    type CreatedApiKeyDto,
    readScope,
  } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import {
    DEFAULT_EXPIRATION,
    EXAMPLE_LANGUAGES,
    exampleSnippets,
    expiresAtFor,
    minCustomDate,
    type ExampleLanguage,
    type ExpirationChoice,
    type Recipe,
  } from "../api-key-form";
  import { RECIPE_GUIDES, RECIPE_LABELS } from "../recipes";
  import { RESOURCE_LABELS } from "../resources";

  let {
    onclose,
    recipe = null,
  }: {
    onclose: () => void;
    /** Opens with a recipe's name and resources already filled in. */
    recipe?: Recipe | null;
  } = $props();

  const FORM_ID = "api-key-form";

  // The modal is mounted per use, so `recipe` is only ever read once.
  const initial = untrack(() => recipe);
  let name = $state(initial ? RECIPE_LABELS[initial.id].name() : "");
  let readable = $state(new Set<ApiKeyResource>(initial?.resources ?? []));
  let language = $state<ExampleLanguage>("curl");
  let expiration = $state<ExpirationChoice>(DEFAULT_EXPIRATION);
  let customDate = $state("");
  let created = $state<CreatedApiKeyDto | null>(null);
  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const createMut = createApiMutation(() => ({
    mutate: createApiKey,
    coveredFields: ["name", "expiresAt"],
    invalidates: [keys.apiKeys.all()],
    onSuccess: (data) => (created = data),
  }));

  const EXPIRATIONS: { value: ExpirationChoice; label: string }[] = [
    { value: "30", label: m.settings_api_keys_expiration_30() },
    { value: "90", label: m.settings_api_keys_expiration_90() },
    { value: "365", label: m.settings_api_keys_expiration_365() },
    { value: "custom", label: m.settings_api_keys_expiration_custom() },
    { value: "never", label: m.settings_api_keys_expiration_never() },
  ];

  const snippets = $derived(
    created && exampleSnippets(API_URL, created.secret, created.apiKey.scopes),
  );

  const canSubmit = $derived(
    name.trim().length > 0 &&
      readable.size > 0 &&
      (expiration !== "custom" || customDate !== ""),
  );

  $effect(() => () => clearTimeout(copiedTimer));

  function toggle(resource: ApiKeyResource) {
    const next = new Set(readable);
    if (next.has(resource)) next.delete(resource);
    else next.add(resource);
    readable = next;
  }

  function readEverything() {
    readable = new Set(API_KEY_RESOURCES);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    createMut.mutate({
      name: name.trim(),
      scopes: API_KEY_RESOURCES.filter((r) => readable.has(r)).map(readScope),
      expiresAt: expiresAtFor(expiration, customDate),
    });
  }

  async function copySecret() {
    if (!created) return;
    await navigator.clipboard.writeText(created.secret);
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2000);
  }
</script>

<Modal
  title={created
    ? m.settings_api_keys_created_title()
    : m.settings_api_keys_create_title()}
  {onclose}
  wide
  dismissable={!created}>
  <AnimatedHeight>
    {#if !created}
      <form
        id={FORM_ID}
        onsubmit={submit}
        novalidate
        class="flex min-w-0 flex-col gap-5 [grid-area:1/1]">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">{m.common_name()}</span>
          <input
            type="text"
            name="name"
            autocomplete="off"
            maxlength={API_KEY_NAME_MAX_LENGTH}
            placeholder={m.settings_api_keys_name_placeholder()}
            aria-invalid={createMut.fieldErrors.name ? "true" : undefined}
            aria-describedby="api-key-name-error"
            bind:value={name}
            class="input" />
        </label>
        <FieldError
          id="api-key-name-error"
          message={createMut.fieldErrors.name} />

        <div
          role="group"
          aria-labelledby="api-key-access-label"
          class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <span id="api-key-access-label" class="text-sm font-semibold">
              {m.settings_api_keys_detail_access()}
            </span>
            <button
              type="button"
              class="btn-text text-sm"
              onclick={readEverything}>
              {m.settings_api_keys_all_read()}
            </button>
          </div>
          <div class="border-border overflow-hidden rounded-lg border">
            <table class="w-full text-sm">
              <thead class="bg-surface-2">
                <tr
                  class="text-dim font-mono text-[0.7rem] tracking-wider uppercase">
                  <th class="px-3 py-2 text-left font-normal">
                    {m.settings_api_keys_resource()}
                  </th>
                  <th class="w-20 px-2 py-2 font-normal">
                    {m.settings_api_keys_read()}
                  </th>
                  <th class="w-20 px-2 py-2 font-normal opacity-50">
                    {m.settings_api_keys_write()}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border divide-y">
                {#each API_KEY_RESOURCES as resource (resource)}
                  {@const labels = RESOURCE_LABELS[resource]}
                  <tr>
                    <td class="px-3 py-2">
                      <span class="block font-medium">{labels.label()}</span>
                      <span class="text-dim block text-xs"
                        >{labels.description()}</span>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        class="accent-accent h-4 w-4"
                        aria-label="{labels.label()} — {m.settings_api_keys_read()}"
                        checked={readable.has(resource)}
                        onchange={() => toggle(resource)} />
                    </td>
                    <td class="px-2 py-2 text-center opacity-40">
                      <input
                        type="checkbox"
                        class="h-4 w-4"
                        disabled
                        aria-label="{labels.label()} — {m.settings_api_keys_write()}" />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <p class="text-dim text-xs">{m.settings_api_keys_access_hint()}</p>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold">
            {m.settings_api_keys_expiration()}
          </span>
          <SegmentedControl
            label={m.settings_api_keys_expiration()}
            options={EXPIRATIONS}
            value={expiration}
            onChange={(value) => (expiration = value)}
            class="flex-wrap self-start" />
          {#if expiration === "custom"}
            <input
              type="date"
              class="input self-start"
              min={minCustomDate()}
              aria-label={m.settings_api_keys_expiration_date()}
              bind:value={customDate} />
          {/if}
          {#if expiration === "never"}
            <Banner variant="warning">
              {m.settings_api_keys_never_warning()}
            </Banner>
          {:else}
            <p class="text-dim flex items-center gap-1.5 text-xs">
              <Icon name="mail" class="h-3.5 w-3.5 shrink-0" />
              {m.settings_api_keys_expiry_mail()}
            </p>
          {/if}
          <FieldError message={createMut.fieldErrors.expiresAt} />
        </div>

        {#if createMut.error}
          <Banner variant="error">{createMut.error}</Banner>
        {/if}
      </form>
    {:else}
      <div class="flex min-w-0 flex-col gap-4 [grid-area:1/1]">
        <Banner variant="warning">
          {m.settings_api_keys_created_warning()}
        </Banner>
        <div class="relative">
          <input
            type="text"
            readonly
            aria-label={m.settings_api_keys_detail_key()}
            value={created.secret}
            onfocus={(e) => e.currentTarget.select()}
            class="input w-full pr-11 font-mono text-xs" />
          <button
            type="button"
            class="btn-icon absolute top-1/2 right-1.5 h-8 w-8 -translate-y-1/2 transition-colors {copied
              ? 'text-success'
              : 'text-dim hover:text-fg'}"
            title={copied ? m.common_copied() : m.common_copy()}
            aria-label={copied ? m.common_copied() : m.common_copy()}
            onclick={copySecret}>
            <Icon name={copied ? "check" : "copy"} class="h-4 w-4" />
          </button>
        </div>
        <p class="text-dim flex items-start gap-2 text-xs">
          <Icon name="mail" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {m.settings_api_keys_created_mail()}
        </p>
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold"
              >{m.settings_api_keys_example()}</span>
            <SegmentedControl
              label={m.settings_api_keys_example()}
              options={EXAMPLE_LANGUAGES.map((value) => ({
                value,
                label: value,
              }))}
              value={language}
              onChange={(value) => (language = value)} />
          </div>
          <pre
            class="bg-surface-2 rounded-lg px-3 py-2.5 font-mono text-xs break-all whitespace-pre-wrap">{snippets?.[
              language
            ]}</pre>
        </div>
        <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a
            href={`${DOCS_URL}/api/`}
            target="_blank"
            rel="noopener noreferrer"
            class="link-accent">{m.settings_api_keys_getting_started()}</a>
          {#if initial}
            <a
              href={RECIPE_GUIDES[initial.id]}
              target="_blank"
              rel="noopener noreferrer"
              class="link-accent">{m.settings_api_keys_recipe_guide()}</a>
          {/if}
        </p>
      </div>
    {/if}
  </AnimatedHeight>

  {#snippet actions()}
    <div class="flex flex-wrap items-center justify-end gap-2">
      {#if !created}
        <button type="button" class="btn btn-ghost" onclick={onclose}>
          {m.common_cancel()}
        </button>
        <button
          type="submit"
          form={FORM_ID}
          class="btn btn-primary"
          disabled={!canSubmit || createMut.loading}>
          {createMut.loading
            ? m.settings_api_keys_creating()
            : m.settings_api_keys_create_submit()}
        </button>
      {:else}
        <button type="button" class="btn btn-primary" onclick={onclose}>
          {m.settings_api_keys_copied_done()}
        </button>
      {/if}
    </div>
  {/snippet}
</Modal>
