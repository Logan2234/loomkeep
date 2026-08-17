<script lang="ts">
  // The "Menu" launcher: a full-width sheet that rises from the bottom bar and
  // lays out every destination as tiles — the mobile counterpart of the desktop
  // rail. In the app it groups libraries + tracking/account; inside /admin it
  // swaps to the admin sections (mirroring the rail) so admin subpages stay
  // reachable on a phone. Admin lives here — it has no bottom-bar slot by
  // default. Notifications aren't a destination at all: see the fixed bell
  // (NotificationBell.svelte) in the root layout instead.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { logout } from "$lib/api/auth";
  import { auth } from "$lib/auth.svelte";
  import Drawer from "$lib/components/Drawer.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { appConfig } from "$lib/config.svelte";
  import { ADMIN_NAV } from "$lib/constants/admin-nav";
  import { isDomainEnabled } from "$lib/domains";
  import { isFeatureNew } from "$lib/feature-badges";
  import { resolveMenuGroups } from "$lib/navigation";
  import { m } from "$lib/paraglide/messages.js";
  import type { ComponentProps } from "svelte";

  type IconName = ComponentProps<typeof Icon>["name"];

  let open = $state(false);

  const inAdmin = $derived(page.url.pathname.startsWith("/app/admin"));

  const groups = $derived(
    resolveMenuGroups({
      isDomainEnabled,
      isAdmin: auth.isAdmin,
      socialEnabled: appConfig.socialEnabled,
    }),
  );

  function close() {
    open = false;
  }

  async function signOut() {
    close();
    await logout();
    await goto("/login");
  }

  $effect(() => {
    const handler = () => (open = !open);
    window.addEventListener("mobile-menu-toggle", handler);
    return () => window.removeEventListener("mobile-menu-toggle", handler);
  });
</script>

{#snippet tile(dest: {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  comingSoon?: boolean;
  newBadgeKey?: string;
})}
  {@const active = dest.match(page.url.pathname)}
  {#if dest.comingSoon}
    <div
      class="border-border text-dim/70 flex flex-col items-center gap-2 rounded-2xl border border-dashed p-3 text-center">
      <Icon name={dest.icon} class="h-6 w-6" />
      <span class="text-xs font-semibold">{dest.label}</span>
      <span class="text-dim/60 text-[0.6rem] font-bold tracking-wide uppercase">
        {m.common_coming_soon()}
      </span>
    </div>
  {:else}
    <a
      href={dest.href}
      onclick={close}
      aria-current={active ? "page" : undefined}
      class="relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors {active
        ? 'border-accent/40 bg-accent/10 text-accent'
        : 'border-border bg-surface-2 hover:border-accent/40 text-fg'}">
      {#if dest.newBadgeKey && isFeatureNew(dest.newBadgeKey)}
        <span
          class="bg-accent ring-surface absolute top-2 right-2 h-2 w-2 rounded-full ring-2"
          aria-hidden="true"></span>
      {/if}
      <Icon name={dest.icon} class="text-accent h-6 w-6" />
      <span class="text-xs font-semibold">{dest.label}</span>
    </a>
  {/if}
{/snippet}

{#if open}
  <Drawer onclose={close} labelledby="menu-sheet-title">
    <div class="shrink-0 px-5 pt-2 pb-2">
      <h2
        id="menu-sheet-title"
        class="font-display text-xl font-extrabold tracking-tight">
        {inAdmin ? m.nav_administration() : m.nav_menu()}
      </h2>
    </div>

    <div
      data-drawer-scroll
      class="flex-1 touch-pan-y overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {#if inAdmin}
        <div class="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {#each ADMIN_NAV.filter((item) => !item.devOnly || appConfig.erdEnabled) as item (item.href)}
            {@render tile(item)}
          {/each}
        </div>

        <a
          href="/app"
          onclick={close}
          class="border-border bg-surface-2 hover:border-accent/40 text-fg mt-4 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold">
          <Icon name="chevron-left" class="h-4 w-4" />
          {m.nav_back_to_app()}
        </a>
      {:else}
        {#each groups as group (group.label)}
          <div class="mt-4 first:mt-2">
            <!-- Séance: section label as a timecode with a letterbox hairline. -->
            <div class="mb-2.5 flex items-center gap-3">
              <span
                class="timecode text-[0.65rem] font-bold tracking-[0.14em] uppercase">
                {group.label}
              </span>
              <span class="bg-border h-px flex-1"></span>
            </div>
            <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {#each group.items as item (item.id)}
                {@render tile(item)}
              {/each}
              {#if group.label === m.nav_menu_section_account()}
                <button
                  type="button"
                  onclick={signOut}
                  class="border-border bg-surface-2 hover:border-danger/40 text-danger flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors">
                  <Icon name="logout" class="h-6 w-6" />
                  <span class="text-xs font-semibold"
                    >{m.profile_logout()}</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </Drawer>
{/if}
