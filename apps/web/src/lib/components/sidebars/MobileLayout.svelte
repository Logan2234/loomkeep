<script lang="ts">
  import { afterNavigate, onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { pageTransition } from "#lib/page-transition.js";
  import {
    detailPoster,
    isWorkPath,
    namePoster,
    pendingPoster,
    posterImageSrc,
    posterLinkingTo,
    tappedPoster,
  } from "#lib/shared-poster.svelte.js";
  import ProgrammeBoardMobileBar from "#lib/ee/nav/ProgrammeBoardMobileBar.svelte";
  import ProjectorDockMobileBar from "#lib/ee/nav/ProjectorDockMobileBar.svelte";
  import { keyboard } from "#lib/keyboard.svelte.js";
  import type { NavStyle } from "#lib/nav-style.svelte.js";
  import { tick, type Snippet } from "svelte";
  import BottomNavigation from "./BottomNavigation.svelte";
  import EdgeTab from "./EdgeTab.svelte";
  import MenuSheet from "./MenuSheet.svelte";
  import PullToRefresh from "#lib/components/PullToRefresh.svelte";

  let {
    children,
    navStyle = "marquee",
  }: { children: Snippet; navStyle?: NavStyle } = $props();

  let lastTap: Element | null = null;

  // A bottom tab finds its page where it was left, vertically. A page opened
  // any other way starts at the top, as usual.
  const tabScroll = new Map<string, number>();
  const RESTORE_WAIT_MS = 500;
  const tappedBottomBar = () =>
    !!lastTap?.closest("[data-mobile-navigation], [data-library-fan]");

  onNavigate(({ from }) => {
    if (from && tappedBottomBar()) tabScroll.set(from.url.pathname, scrollY);
  });

  afterNavigate(({ to }) => {
    if (!to || !tappedBottomBar()) return;
    const field = document.querySelector<HTMLInputElement>("[data-tab-focus]");
    if (field && !field.value) field.focus({ preventScroll: true });
    const top = tabScroll.get(to.url.pathname);
    if (!top) return;
    // What was loaded may still be growing the page back to its height.
    const until = performance.now() + RESTORE_WAIT_MS;
    const restore = () => {
      scrollTo({ top, behavior: "instant" });
      if (scrollY < top - 1 && performance.now() < until) {
        requestAnimationFrame(restore);
      }
    };
    restore();
  });

  $effect(() => keyboard.init());

  onNavigate((navigation) => {
    const { from, to, complete } = navigation;
    if (
      !document.startViewTransition ||
      prefersReducedMotion() ||
      !from ||
      !to ||
      from.url.pathname === to.url.pathname
    ) {
      return;
    }

    const direction = pageTransition(
      from.url.pathname,
      to.url.pathname,
      "delta" in navigation ? navigation.delta : undefined,
    );
    document.documentElement.dataset.pageTransition = direction;

    // Only one end is on screen at a time, so each is named when it exists.
    const backFromWork = direction === "back" && isWorkPath(from.url.pathname);
    const opening = isWorkPath(to.url.pathname)
      ? tappedPoster(lastTap, to.url.pathname)
      : null;
    pendingPoster.src = posterImageSrc(opening);
    const unnameOld = namePoster(backFromWork ? detailPoster() : opening);
    let unnameNew = () => {};

    return new Promise((resolve) => {
      const transition = document.startViewTransition(async () => {
        resolve();
        await complete;
        await tick();
        unnameOld();
        if (opening) unnameNew = namePoster(detailPoster());
        else if (backFromWork) {
          unnameNew = namePoster(posterLinkingTo(from.url.pathname));
        }
      });
      void transition.finished.finally(() => {
        delete document.documentElement.dataset.pageTransition;
        unnameNew();
      });
    });
  });
</script>

<svelte:window
  onclickcapture={(e) =>
    (lastTap = e.target instanceof Element ? e.target : null)} />

<div class="min-h-svh">
  <main
    id="main"
    class="min-h-svh overflow-x-clip pb-[calc(var(--bottom-bar-space)+var(--floating-bar-space,0px))]">
    {#key page.url.pathname}
      {@render children()}
    {/key}
  </main>

  <!-- Out of the way while typing in the Android app, where the keyboard
       would otherwise carry it up (see keyboard.svelte.ts); kept mounted. -->
  <div style:display={keyboard.open ? "none" : "contents"}>
    {#if navStyle === "dock"}
      <ProjectorDockMobileBar />
    {:else if navStyle === "board"}
      <ProgrammeBoardMobileBar />
    {:else}
      <BottomNavigation />
    {/if}
    <EdgeTab />
  </div>

  <MenuSheet />
  <PullToRefresh />
</div>
