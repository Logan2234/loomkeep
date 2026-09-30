<script lang="ts">
  import { createAdminInvitation } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import AnimatedHeight from "$lib/components/AnimatedHeight.svelte";
  import Banner from "$lib/components/Banner.svelte";
  import FieldError from "$lib/components/FieldError.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import RollingNumber from "$lib/components/RollingNumber.svelte";
  import SegmentedControl from "$lib/components/SegmentedControl.svelte";
  import { formatDate } from "$lib/format";
  import { prefersReducedMotion } from "$lib/motion";
  import { m } from "$lib/paraglide/messages.js";
  import {
    INVITATION_MAX_USES,
    INVITATION_VALIDITY_DAYS,
    type AdminInvitationLinkDto,
  } from "@loomkeep/shared";
  import { untrack } from "svelte";
  import { backOut, cubicOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";

  type Mode = "email" | "link";
  type Validity = (typeof INVITATION_VALIDITY_DAYS)[number];

  let {
    onclose,
    onCreated,
    initial = null,
  }: {
    onclose: () => void;
    /** Fired once per invitation minted from the form. */
    onCreated?: () => void;
    /** Opens straight on the result step — a link renewed from the list. */
    initial?: AdminInvitationLinkDto | null;
  } = $props();

  const reduced = prefersReducedMotion();
  const FORM_ID = "invite-user-form";

  // The modal is mounted per use, so `initial` is only ever read once.
  const renewed = untrack(() => initial !== null);
  let result = $state<AdminInvitationLinkDto | null>(untrack(() => initial));
  let mode = $state<Mode>("email");
  let email = $state("");
  let places = $state(1);
  let label = $state("");
  let validity = $state<Validity>(7);

  let qrSvg = $state("");
  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  let emailInput = $state<HTMLInputElement>();

  const createMut = createApiMutation(() => ({
    mutate: createAdminInvitation,
    coveredFields: ["email", "label"],
    invalidates: [keys.admin.invitations()],
    onSuccess: (data) => {
      result = data;
      onCreated?.();
    },
  }));

  const MODES = [
    {
      value: "email" as const,
      label: m.admin_invitations_mode_email(),
      icon: "mail" as const,
    },
    {
      value: "link" as const,
      label: m.admin_invitations_mode_link(),
      icon: "link" as const,
    },
  ];
  const VALIDITIES: { value: `${Validity}`; label: string }[] = [
    { value: "1", label: m.admin_invitations_validity_1() },
    { value: "7", label: m.admin_invitations_validity_7() },
    { value: "30", label: m.admin_invitations_validity_30() },
  ];

  const canSubmit = $derived(mode === "link" || email.trim().length > 0);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  $effect(() => {
    const url = result?.url;
    if (!url) return;
    qrSvg = "";
    let cancelled = false;

    (async () => {
      const { default: QRCode } = await import("qrcode");
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      if (!cancelled) qrSvg = svg;
    })();

    return () => {
      cancelled = true;
    };
  });

  $effect(() => () => clearTimeout(copiedTimer));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    createMut.mutate({
      email: mode === "email" ? email.trim() : undefined,
      label: label.trim() || undefined,
      maxUses: mode === "email" ? 1 : places,
      validityDays: validity,
    });
  }

  function changeMode(next: Mode) {
    mode = next;
    createMut.reset();
    if (next === "email") queueMicrotask(() => emailInput?.focus());
  }

  function changePlaces(delta: number) {
    places = Math.min(INVITATION_MAX_USES, Math.max(1, places + delta));
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 2000);
  }

  async function shareLink() {
    if (!result) return;
    try {
      await navigator.share({
        title: m.auth_invitation_generic(),
        url: result.url,
      });
    } catch {
      // Sheet dismissed — nothing to do, the link is still on screen.
    }
  }

  function inviteAnother() {
    result = null;
    email = "";
    label = "";
    places = 1;
    copied = false;
    createMut.reset();
    queueMicrotask(() => emailInput?.focus());
  }

  const stepIn = (node: Element, forward: boolean) =>
    fly(node, {
      x: forward ? 24 : -24,
      duration: reduced ? 0 : 240,
      delay: reduced ? 0 : 80,
      easing: cubicOut,
    });
  const stepOut = (node: Element, forward: boolean) =>
    fly(node, {
      x: forward ? -24 : 24,
      duration: reduced ? 0 : 140,
      easing: cubicOut,
    });
</script>

<Modal
  title={result
    ? renewed
      ? m.admin_invitations_renewed_title()
      : m.admin_invitations_ready_title()
    : m.admin_invitations_modal_title()}
  eyebrow={m.admin_invitations_modal_eyebrow()}
  {onclose}>
  <AnimatedHeight>
    {#if !result}
      <form
        id={FORM_ID}
        onsubmit={submit}
        novalidate
        class="flex flex-col gap-5 [grid-area:1/1]"
        in:stepIn={false}
        out:stepOut={true}>
        <SegmentedControl
          label={m.admin_invitations_mode_label()}
          options={MODES}
          value={mode}
          onChange={changeMode}
          class="self-start" />

        <AnimatedHeight>
          {#key mode}
            <div
              class="[grid-area:1/1]"
              in:fade={{ duration: reduced ? 0 : 180, delay: reduced ? 0 : 60 }}
              out:fade={{ duration: reduced ? 0 : 100 }}>
              {#if mode === "email"}
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold"
                    >{m.admin_invitations_email_label()}</span>
                  <input
                    bind:this={emailInput}
                    type="email"
                    name="email"
                    autocomplete="off"
                    inputmode="email"
                    placeholder={m.admin_invitations_email_placeholder()}
                    aria-invalid={createMut.fieldErrors.email
                      ? "true"
                      : undefined}
                    aria-describedby="invite-email-hint invite-email-error"
                    bind:value={email}
                    class="input" />
                </label>
                <FieldError
                  id="invite-email-error"
                  message={createMut.fieldErrors.email} />
                <p id="invite-email-hint" class="text-dim mt-1.5 text-xs">
                  {m.admin_invitations_email_hint()}
                </p>
              {:else}
                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <p id="invite-places-label" class="text-sm font-semibold">
                      {m.admin_invitations_places_label()}
                    </p>
                    <p class="text-dim mt-0.5 text-xs">
                      {m.admin_invitations_places_hint()}
                    </p>
                  </div>
                  <div
                    role="group"
                    aria-labelledby="invite-places-label"
                    class="border-border bg-surface-2 flex shrink-0 items-center gap-1 rounded-full border p-1">
                    <button
                      type="button"
                      class="btn-icon h-8 w-8 rounded-full text-lg leading-none"
                      aria-label={m.admin_invitations_places_decrease()}
                      disabled={places <= 1}
                      onclick={() => changePlaces(-1)}>−</button>
                    <span
                      class="font-display w-7 text-center text-lg font-bold tabular-nums"
                      aria-live="polite">
                      <RollingNumber value={places} />
                    </span>
                    <button
                      type="button"
                      class="btn-icon h-8 w-8 rounded-full"
                      aria-label={m.admin_invitations_places_increase()}
                      disabled={places >= INVITATION_MAX_USES}
                      onclick={() => changePlaces(1)}>
                      <Icon name="plus" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/key}
        </AnimatedHeight>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">
            {m.admin_invitations_label_label()}
            <span class="text-dim font-normal"
              >· {m.admin_invitations_label_optional()}</span>
          </span>
          <input
            type="text"
            name="label"
            maxlength="60"
            autocomplete="off"
            placeholder={m.admin_invitations_label_placeholder()}
            aria-invalid={createMut.fieldErrors.label ? "true" : undefined}
            aria-describedby="invite-label-error"
            bind:value={label}
            class="input" />
        </label>
        <FieldError
          id="invite-label-error"
          message={createMut.fieldErrors.label} />

        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold" id="invite-validity-label">
            {m.admin_invitations_validity_label()}
          </span>
          <SegmentedControl
            label={m.admin_invitations_validity_label()}
            options={VALIDITIES}
            value={`${validity}`}
            onChange={(value) => (validity = Number(value) as Validity)} />
        </div>

        {#if createMut.error}
          <Banner variant="error">{createMut.error}</Banner>
        {/if}
      </form>
    {:else}
      <div
        class="flex flex-col items-center gap-4 [grid-area:1/1]"
        in:stepIn={true}
        out:stepOut={false}>
        <div
          class="bg-success/15 text-success grid h-12 w-12 place-items-center rounded-full"
          in:scale={{
            start: 0.4,
            duration: reduced ? 0 : 380,
            delay: reduced ? 0 : 160,
            easing: backOut,
          }}>
          <Icon name="check" class="h-6 w-6" />
        </div>

        {#if result.emailed && result.invitation.email}
          <p class="text-dim -mt-1 text-center text-sm">
            {m.admin_invitations_emailed({ email: result.invitation.email })}
          </p>
        {:else if result.invitation.email}
          <Banner variant="warning" class="w-full">
            {m.admin_invitations_not_emailed()}
          </Banner>
        {/if}

        <div class="flex flex-col items-center gap-2">
          <div
            class="qr-frame grid h-44 w-44 place-items-center rounded-xl bg-white p-2.5 shadow-sm">
            {#if qrSvg}
              <!-- svg is qrcode's own generated markup (rects/paths only), not user input -->
              <div in:fade={{ duration: reduced ? 0 : 200 }}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html qrSvg}
              </div>
            {:else}
              <div
                class="h-full w-full rounded-lg bg-black/5 {reduced
                  ? ''
                  : 'animate-pulse'}">
              </div>
            {/if}
          </div>
          <p class="text-dim text-xs">{m.admin_invitations_scan_hint()}</p>
        </div>

        <div class="flex w-full flex-col gap-1.5">
          <label for="invite-link" class="text-sm font-semibold">
            {m.admin_invitations_link_label()}
          </label>
          <div class="flex gap-2">
            <input
              id="invite-link"
              type="text"
              readonly
              value={result.url}
              onfocus={(e) => e.currentTarget.select()}
              class="input min-w-0 flex-1 font-mono text-xs" />
            <button
              type="button"
              class="btn shrink-0 {copied
                ? 'btn-ghost text-success'
                : 'btn-primary'}"
              onclick={copyLink}>
              <span class="inline-grid">
                {#key copied}
                  <span
                    class="inline-flex items-center gap-1.5 [grid-area:1/1]"
                    in:fly={{ y: 6, duration: reduced ? 0 : 160 }}
                    out:fade={{ duration: reduced ? 0 : 80 }}>
                    <Icon name={copied ? "check" : "link"} class="h-4 w-4" />
                    {copied ? m.common_copied() : m.common_copy()}
                  </span>
                {/key}
              </span>
            </button>
          </div>
        </div>

        <ul
          class="text-dim flex w-full flex-wrap gap-x-3 gap-y-1 text-xs"
          aria-label={m.admin_invitations_modal_eyebrow()}>
          <li class="flex items-center gap-1">
            <Icon name="hourglass" class="h-3.5 w-3.5" />
            {m.admin_invitations_valid_until({
              date: formatDate(result.invitation.expiresAt),
            })}
          </li>
          <li class="flex items-center gap-1">
            <Icon name="users" class="h-3.5 w-3.5" />
            {result.invitation.maxUses - result.invitation.useCount === 1
              ? m.admin_invitations_one_place()
              : m.admin_invitations_places_count({
                  count: result.invitation.maxUses - result.invitation.useCount,
                })}
          </li>
          {#if result.invitation.label}
            <li class="text-fg flex items-center gap-1">
              <Icon name="list" class="h-3.5 w-3.5" />
              {result.invitation.label}
            </li>
          {/if}
        </ul>

        <p
          class="border-border text-dim flex w-full items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <Icon name="lock" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {m.admin_invitations_one_time_warning()}
        </p>
      </div>
    {/if}
  </AnimatedHeight>

  {#snippet actions()}
    <div class="grid">
      {#key result === null}
        <div
          class="flex flex-wrap items-center justify-end gap-2 [grid-area:1/1]"
          in:fade={{ duration: reduced ? 0 : 180, delay: reduced ? 0 : 80 }}
          out:fade={{ duration: reduced ? 0 : 100 }}>
          {#if !result}
            <button type="button" class="btn btn-ghost" onclick={onclose}>
              {m.common_cancel()}
            </button>
            <button
              type="submit"
              form={FORM_ID}
              class="btn btn-primary"
              disabled={!canSubmit || createMut.loading}>
              <Icon name="send" class="h-4 w-4" />
              {createMut.loading
                ? m.admin_invitations_creating()
                : m.admin_invitations_create()}
            </button>
          {:else}
            {#if canShare}
              <button
                type="button"
                class="btn btn-ghost mr-auto"
                onclick={shareLink}>
                <Icon name="share" class="h-4 w-4" />
                {m.common_share()}
              </button>
            {/if}
            <button type="button" class="btn btn-ghost" onclick={inviteAnother}>
              {m.admin_invitations_invite_another()}
            </button>
            <button type="button" class="btn btn-primary" onclick={onclose}>
              {m.admin_invitations_done()}
            </button>
          {/if}
        </div>
      {/key}
    </div>
  {/snippet}
</Modal>

<style>
  /* qrcode's SVG output has no intrinsic size beyond its viewBox — pin one. */
  .qr-frame :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .qr-frame > div {
    width: 100%;
    height: 100%;
  }
</style>
