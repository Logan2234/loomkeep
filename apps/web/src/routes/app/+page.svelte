<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { signalVersionLinkClicked } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import BetaBadge from "$lib/components/BetaBadge.svelte";
  import HomeGrid from "$lib/components/home/HomeGrid.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import NewBadge from "$lib/components/NewBadge.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { GITHUB_REPO_URL } from "$lib/constants/external-links";
  import { isFeatureNew } from "$lib/feature-badges";
  import { currentHomeGate } from "$lib/home/gate";
  import { resolveHomeLayout } from "$lib/home/layout";
  import { m } from "$lib/paraglide/messages";

  const widgets = $derived(
    resolveHomeLayout(auth.user?.homeLayout, currentHomeGate()),
  );

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    if (h < 12) return m.home_greeting_morning();
    if (h < 18) return m.home_greeting_afternoon();
    return m.home_greeting_evening();
  });
</script>

<div class="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-10">
  <PageHeader
    icon="home"
    title={`${greeting}${auth.user ? ", " + auth.user.displayName : ""}.`}
    documentTitle={m.common_home()}
    subtitle={m.home_subtitle()}>
    {#snippet actions()}
      <a
        href="/app/settings/appearance/home"
        class="btn btn-ghost btn-sm group gap-1.5 self-center">
        <Icon
          name="layout"
          class="h-4 w-4 transition-transform group-hover:scale-110" />
        {m.home_customize()}
        {#if isFeatureNew("home-layout")}<NewBadge />{/if}
      </a>
    {/snippet}
  </PageHeader>

  {#if widgets.length > 0}
    <HomeGrid {widgets} />
  {:else}
    <a
      href="/app/settings/appearance/home"
      class="border-border text-dim hover:border-accent hover:text-accent flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center transition-colors">
      <Icon name="layout" class="h-7 w-7" />
      <span class="text-sm font-semibold">{m.home_editor_empty()}</span>
    </a>
  {/if}

  <p class="text-dim mt-8 flex items-center justify-center gap-2 text-xs">
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => signalVersionLinkClicked()}
      class="btn-text font-normal {appConfig.version ? '' : 'invisible'}">
      {m.app_version({ version: appConfig.version })}
      {#if appConfig.gitSha && appConfig.gitSha !== "unknown"}
        <span class="opacity-60">({appConfig.gitSha})</span>
      {/if}
    </a>
    {#if env.PUBLIC_IS_BETA}<BetaBadge />{/if}
  </p>
</div>
