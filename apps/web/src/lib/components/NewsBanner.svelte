<script lang="ts">
  // The site-wide announcement strip (see $lib/news-banner for the flag and
  // its payload). Mounted once, in the root layout, above every page.
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import { liveFlags } from "$lib/feature-flags-live.svelte";
  import { formatDateTime } from "$lib/format";
  import {
    NEWS_BANNER_FLAG,
    customText,
    isExternalHref,
    isNewsBannerLive,
    newsBannerFitsPage,
    parseNewsBanner,
  } from "$lib/news-banner";
  import { m } from "$lib/paraglide/messages";
  import { getLocale } from "$lib/paraglide/runtime";
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
      case "custom":
        return customText(shown.data, getLocale());
    }
  });
</script>

{#if shown}
  {@const warning = shown.severity === "warning"}
  <div
    role="status"
    class="border-b text-sm {warning
      ? 'border-accent/40 bg-accent/10'
      : 'border-border bg-surface'}">
    <!-- In the app, the notification bell is pinned to the top-right corner:
         keep the close button out from under it. -->
    <div
      class="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 {inApp
        ? 'pr-16'
        : ''}">
      <!-- The label sits inside the sentence, so a long message wraps under
           it rather than leaving it stranded beside a tall block of text. -->
      <p class="text-fg min-w-0 flex-1 basis-64 leading-relaxed">
        <span
          class="mr-2 inline-block rounded-sm border px-1.5 py-0.5 align-[1px] font-mono text-[0.6rem] leading-none font-bold tracking-widest uppercase {warning
            ? 'border-accent/60 text-accent'
            : 'border-border text-dim'}">
          {warning ? m.news_banner_label_warning() : m.news_banner_label_info()}
        </span>{text}
      </p>
      {#if shown.href || shown.dismissible}
        <div class="ml-auto flex shrink-0 items-center gap-1">
          {#if shown.href}
            {@const external = isExternalHref(shown.href)}
            <a
              class="btn btn-ghost btn-sm"
              href={shown.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}>
              {m.news_banner_cta()}
              <Icon name="chevron-right" class="h-3.5 w-3.5" />
            </a>
          {/if}
          {#if shown.dismissible}
            <button
              type="button"
              class="btn-icon"
              aria-label={m.common_close()}
              title={m.common_close()}
              onclick={() => dismiss(shown.id)}>
              <Icon name="x" class="h-4 w-4" />
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
