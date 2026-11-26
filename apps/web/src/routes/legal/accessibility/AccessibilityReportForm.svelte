<script lang="ts">
  import { reportAccessibility } from "#lib/api/contact.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Banner from "#lib/components/Banner.svelte";
  import Turnstile from "#lib/components/Turnstile.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import * as env from "$app/env/public";

  const MESSAGE_MIN = 20;
  const MESSAGE_MAX = 5000;
  const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY;

  let message = $state("");
  let page = $state("");
  let email = $state(auth.user?.email ?? "");
  // Hidden from people and screen readers: only a bot fills it in.
  let website = $state("");
  let turnstileToken = $state("");
  let sent = $state(false);

  const reportMut = createApiMutation(() => ({
    mutate: reportAccessibility,
    onSuccess: () => (sent = true),
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    reportMut.mutate({
      message,
      page: page || undefined,
      email: email || undefined,
      locale: getLocale(),
      website: website || undefined,
      turnstileToken: turnstileToken || undefined,
    });
  }
</script>

{#if sent}
  <p role="status" class="bg-surface-2 rounded-lg px-4 py-3">
    {m.accessibility_form_sent()}
  </p>
{:else}
  <form class="flex flex-col gap-4" onsubmit={submit}>
    <div class="flex flex-col gap-1.5">
      <label for="a11y-message" class="text-sm font-semibold">
        {m.accessibility_form_message()}
      </label>
      <textarea
        id="a11y-message"
        name="message"
        rows="5"
        minlength={MESSAGE_MIN}
        maxlength={MESSAGE_MAX}
        aria-describedby="a11y-message-hint"
        bind:value={message}
        required
        class="input min-h-32 resize-y"></textarea>
      <span id="a11y-message-hint" class="text-dim text-xs">
        {m.accessibility_form_message_hint()}
      </span>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="a11y-page" class="text-sm font-semibold">
        {m.accessibility_form_page()}
      </label>
      <input
        id="a11y-page"
        name="page"
        maxlength="300"
        placeholder="/app/search"
        bind:value={page}
        class="input" />
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="a11y-email" class="text-sm font-semibold">
        {m.accessibility_form_email()}
      </label>
      <input
        id="a11y-email"
        name="email"
        type="email"
        autocomplete="email"
        aria-describedby="a11y-email-hint"
        bind:value={email}
        class="input" />
      <span id="a11y-email-hint" class="text-dim text-xs">
        {m.accessibility_form_email_hint()}
      </span>
    </div>
    <div class="absolute -left-[9999px]" aria-hidden="true">
      <input
        name="website"
        tabindex="-1"
        autocomplete="off"
        bind:value={website} />
    </div>
    {#if turnstileSiteKey}
      <Turnstile
        siteKey={turnstileSiteKey}
        onVerify={(token) => (turnstileToken = token)} />
    {/if}
    {#if reportMut.error}
      <Banner variant="error">{reportMut.error}</Banner>
    {/if}
    <button
      type="submit"
      class="btn btn-primary self-start"
      disabled={reportMut.loading ||
        message.trim().length < MESSAGE_MIN ||
        (!!turnstileSiteKey && !turnstileToken)}>
      {reportMut.loading ? m.common_sending() : m.common_send()}
    </button>
  </form>
{/if}
