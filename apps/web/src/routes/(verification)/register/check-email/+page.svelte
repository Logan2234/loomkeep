<script lang="ts">
  import { Cooldown } from "#lib/cooldown.svelte.js";

  import { goto } from "$app/navigation";
  import { resendVerificationEmail } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import AuthShell from "#lib/components/AuthShell.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import SealedEnvelope from "#lib/components/SealedEnvelope.svelte";
  import { mailInboxFor } from "#lib/mail-inbox.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    connectRealtimeSocket,
    onRealtimeEvent,
  } from "#lib/realtime/socket.js";
  import { RealtimeEvent } from "@loomkeep/shared";

  let pageReady = $state(false);
  let confirmed = $state(false);
  const cooldown = new Cooldown();
  $effect(() => () => cooldown.stop());

  const email = $derived(auth.user?.email ?? "");
  const inbox = $derived(mailInboxFor(email));

  const resendMut = createApiMutation(() => ({
    mutate: resendVerificationEmail,
    onSuccess: () => {
      cooldown.start(60);
    },
  }));

  // "sent" lasts as long as the cooldown; once it expires this reverts to
  // "idle" on its own, matching the resend button re-enabling.
  const status = $derived<"idle" | "loading" | "sent" | "error">(
    resendMut.loading
      ? "loading"
      : resendMut.error
        ? "error"
        : cooldown.remaining > 0
          ? "sent"
          : "idle",
  );
  const error = $derived(resendMut.error);

  // The link is often opened on another device (the phone's mail app): the
  // API tells every open screen of the account. The socket is left connected
  // on leaving, since the next stop is /app, which keeps it anyway.
  $effect(() => {
    if (!pageReady || confirmed) return;
    connectRealtimeSocket();
    return onRealtimeEvent(RealtimeEvent.EMAIL_VERIFIED, () => {
      confirmed = true;
      if (auth.user) auth.user = { ...auth.user, emailVerified: true };
    });
  });

  function resend() {
    if (resendMut.loading || cooldown.remaining > 0) return;
    resendMut.mutate();
  }

  function continueToApp() {
    void goto("/app");
  }

  if (auth.user?.emailVerified) {
    continueToApp();
  } else {
    pageReady = true;
  }
</script>

<svelte:head>
  <title>{m.auth_register_check_email_title()} · {m.common_loomkeep()}</title>
</svelte:head>

{#if pageReady}
  <AuthShell
    page="/register/check-email"
    tagline={m.auth_register_check_email_tagline()}
    phoneWall>
    <div class="flex flex-1 flex-col">
      <div class="flex justify-center py-6 lg:justify-start lg:pt-0 lg:pb-8">
        <SealedEnvelope {confirmed} />
      </div>

      <h1
        class="font-display text-[1.65rem] leading-tight font-extrabold tracking-tight text-balance">
        {m.auth_register_check_email_ready({
          name: auth.user?.displayName ?? "",
        })}
      </h1>
      <p class="text-dim mt-2">
        {confirmed
          ? m.auth_register_check_email_confirmed()
          : m.auth_register_check_email_body()}
      </p>
      <p
        class="address mt-4 inline-flex max-w-full items-center gap-2 self-start rounded-lg border px-3 py-2 font-semibold transition-colors duration-200 {confirmed
          ? 'border-success'
          : 'border-border bg-surface-2'}">
        <Icon
          name={confirmed ? "check" : "mail"}
          class="h-4 w-4 shrink-0 {confirmed
            ? 'text-success'
            : 'text-accent'}" />
        <span class="truncate">{email}</span>
      </p>

      <div class="mt-auto flex flex-col gap-3 pt-8 lg:mt-10 lg:pt-0">
        {#if status === "error" && error}
          <p class="text-danger text-center text-sm">{error}</p>
        {/if}
        <button
          type="button"
          class="btn btn-primary btn-primary-cartouche"
          onclick={continueToApp}>
          {m.auth_register_check_email_continue()}
        </button>
        {#if !confirmed}
          {#if inbox}
            <a
              class="btn btn-ghost"
              href={inbox.url}
              target="_blank"
              rel="noopener noreferrer">
              <Icon name="external" class="h-4 w-4" />
              {m.auth_register_check_email_open_inbox({ inbox: inbox.name })}
            </a>
          {/if}
          <p class="text-dim text-center text-sm text-balance">
            {#if status === "sent"}
              <span class="text-success font-semibold"
                >{m.auth_register_check_email_sent()}</span>
            {:else}
              {m.auth_register_check_email_hint()}
            {/if}
            <button
              type="button"
              class="text-accent disabled:text-dim font-semibold disabled:font-normal"
              onclick={resend}
              disabled={status === "loading" || cooldown.remaining > 0}>
              {#if status === "loading"}
                {m.common_sending()}
              {:else if cooldown.remaining > 0}
                {m.common_resend_cooldown({ seconds: cooldown.remaining })}
              {:else}
                {m.auth_register_check_email_resend()}
              {/if}
            </button>
          </p>
        {/if}
      </div>
    </div>
  </AuthShell>
{/if}

<style>
  /* Lights up as the seal lands, as if the letter had just reached it. */
  .address {
    animation: address-glow 0.6s 1.2s ease-out;
  }

  @keyframes address-glow {
    40% {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 4px
        color-mix(in oklab, var(--color-accent) 25%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .address {
      animation: none;
    }
  }

  :global(.a11y-reduce-motion) .address {
    animation: none;
  }
</style>
