<script lang="ts">
  import { auth } from "#lib/auth.svelte.js";
  import Icon from "#lib/components/Icon.svelte";
  import NewBadge from "#lib/components/NewBadge.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { useOnboardingChecklist } from "#lib/gamification/onboarding-checklist.svelte.js";
  import { currentHomeGate } from "#lib/home/gate.js";
  import {
    phoneWidgetSize,
    resolvePhoneLayout,
  } from "#lib/home/phone-layout.js";
  import { m } from "#lib/paraglide/messages.js";
  import HomeStarter from "./HomeStarter.svelte";
  import HomeWidget from "./HomeWidget.svelte";

  // The phone's own home (HOM-02): one column of widgets in the order its
  // editor keeps, apart from the desktop grid.
  const gate = $derived(currentHomeGate());
  const widgets = $derived(
    resolvePhoneLayout(auth.user?.homePhoneLayout, gate),
  );

  // Until a first title, a single screen to start from. The step is derived
  // live by the API, so the real home takes over as soon as one is added;
  // with gamification off the checklist is empty and the home shows as is.
  const checklist = useOnboardingChecklist();
  const starting = $derived(
    checklist.data?.steps.some((s) => s.key === "add_title" && !s.done) ??
      false,
  );

  // The window's width until the column is measured, so the first frame
  // already lays the shelves out at about their size.
  let measured = $state(0);
  const width = $derived(measured || window.innerWidth);
</script>

<div bind:clientWidth={measured}>
  {#if starting}
    <HomeStarter />
  {:else}
    <div class="flex flex-col gap-4">
      {#each widgets as widget (widget.id)}
        {@const size = phoneWidgetSize(widget, width)}
        <div
          data-welcome-land
          style:height={widget.type === "quickLinks" || widget.type === "note"
            ? undefined
            : `${size.height}px`}>
          <HomeWidget widget={{ ...widget, x: 0, y: 0, w: 12, h: 1 }} {size} />
        </div>
      {/each}
    </div>
    <div class="mt-6 flex justify-center">
      <a
        href="/app/settings/appearance/home"
        class="text-dim hover:text-fg inline-flex items-center gap-2 text-sm transition-colors">
        <Icon name="sliders" class="h-4 w-4" />
        {m.home_customize()}
        {#if isFeatureNew("phone-home")}<NewBadge />{/if}
      </a>
    </div>
  {/if}
</div>
