<script lang="ts">
  // The site-wide announcement strip (see $lib/news-banner for the flag and
  // its payload). Mounted once, in the root layout, above every page.
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { formatDateTime } from "$lib/format";
  import {
    NEWS_BANNER_FLAG,
    isNewsBannerLive,
    newsBannerFitsPage,
    parseNewsBanner,
  } from "$lib/news-banner";
  import { m } from "$lib/paraglide/messages";
  import Icon from "./Icon.svelte";

  const DISMISSED_KEY = "news-banner-dismissed";

  function readDismissed(): string | null {
    try {
      return localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  }

  let dismissedId = $state(readDismissed());

  function dismiss(id: string) {
    dismissedId = id;
    try {
      localStorage.setItem(DISMISSED_KEY, id);
    } catch {
      // Private browsing: it stays closed until the next page load.
    }
  }

  // The flag already updates live; this clock does the same for a banner's
  // start and end dates, so it appears and goes away without a reload.
  let now = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });

  const banner = $derived(
    parseNewsBanner(liveFlags.variantPayload(NEWS_BANNER_FLAG)),
  );
  const inApp = $derived(
    page.url.pathname === "/app" || page.url.pathname.startsWith("/app/"),
  );
  const shown = $derived(
    banner &&
      isNewsBannerLive(banner, now) &&
      newsBannerFitsPage(banner, page.url.pathname) &&
      !(banner.dismissible && banner.id === dismissedId)
      ? banner
      : null,
  );

  // In the reader's own time zone: the account's once signed in, the
  // device's otherwise. A time zone Intl doesn't know falls back to the
  // device's rather than breaking the banner.
  function inZone(iso: string, options: Intl.DateTimeFormatOptions): string {
    const timeZone = auth.user?.timezone || undefined;

    try {
      return formatDateTime(iso, { ...options, timeZone });
    } catch {
      return formatDateTime(iso, options);
    }
  }

  const text = $derived.by(() => {
    if (!shown) return "";

    switch (shown.key) {
      case "maintenance_scheduled": {
        const { start, end } = shown.data;
        const day = (iso: string) => inZone(iso, { dateStyle: "full" });

        if (day(start) === day(end)) {
          const time = (iso: string) => inZone(iso, { timeStyle: "short" });
          return m.news_banner_maintenance_same_day({
            date: day(start),
            start: time(start),
            end: time(end),
          });
        }

        const moment = (iso: string) =>
          inZone(iso, { dateStyle: "full", timeStyle: "short" });
        return m.news_banner_maintenance_range({
          start: moment(start),
          end: moment(end),
        });
      }
      case "degraded_service":
        return m.news_banner_degraded_service();
    }
  });
</script>

{#if shown}
  <div
    role="status"
    class="border-b text-sm {shown.severity === 'warning'
      ? 'border-accent/40 bg-accent/10'
      : 'border-border bg-surface-2'}">
    <!-- In the app, the notification bell is pinned to the top-right corner:
         keep the close button out from under it. -->
    <div
      class="mx-auto flex max-w-5xl items-start gap-3 px-4 py-2.5 {inApp
        ? 'pr-16'
        : ''}">
      <Icon
        name={shown.severity === "warning" ? "warning" : "bell"}
        class="mt-0.5 h-4 w-4 shrink-0 {shown.severity === 'warning'
          ? 'text-accent'
          : 'text-dim'}" />
      <p class="text-fg min-w-0 flex-1">{text}</p>
      {#if shown.dismissible}
        <button
          type="button"
          class="text-dim hover:text-fg -my-1 grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors"
          aria-label={m.common_close()}
          title={m.common_close()}
          onclick={() => dismiss(shown.id)}>
          <Icon name="x" class="h-4 w-4" />
        </button>
      {/if}
    </div>
  </div>
{/if}
