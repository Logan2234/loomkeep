<script lang="ts">
  // The bar's Library tab, always at its centre. It opens the enabled
  // domains as a fan above it: a tap opens it, or a drag from the tab picks
  // one when the finger lets go over it. Inside a domain the tab wears that
  // domain's icon and name. With a single domain there's nothing to choose:
  // the tab is that domain.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { portal } from "#lib/actions/portal.js";
  import Icon from "#lib/components/Icon.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled } from "#lib/domain-availability.js";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import {
    fanBurst,
    fanHit,
    fanOrigin,
    fanPoints,
    fanRadius,
  } from "#lib/library-fan.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import {
    resolveLibraryDomains,
    scrollUpOnReselect,
    type MobileDestination,
  } from "#lib/navigation.js";
  import { m } from "#lib/paraglide/messages.js";
  import { fade } from "svelte/transition";
  import NavTab, { type NavTabLook } from "./NavTab.svelte";

  let { look }: { look?: NavTabLook } = $props();

  const reduced = prefersReducedMotion();
  /** A drag shorter than this is still a tap. */
  const DRAG_START = 10;

  const domains = $derived(resolveLibraryDomains({ isDomainEnabled }));
  const current = $derived(
    domains.find((d) => d.match(page.url.pathname)) ?? null,
  );
  const single = $derived(domains.length === 1 ? domains[0] : null);

  let open = $state(false);
  let hot = $state(-1);
  let origin = $state({ x: 0, y: 0 });
  let radius = $state(140);
  const points = $derived(fanPoints(domains.length, radius));

  let tab: HTMLElement | null = null;
  let drag: { x: number; y: number; id: number; moved: boolean } | null = null;
  let swallowClick = false;

  const tint = (d: MobileDestination) =>
    d.domain ? DOMAINS[d.domain].accent : "var(--accent)";

  function show(focusFirst = false) {
    if (!tab) return;
    const rect = tab.getBoundingClientRect();
    radius = fanRadius(innerWidth);
    origin = {
      x: fanOrigin(rect.left + rect.width / 2, innerWidth, radius),
      y: rect.top + rect.height / 2,
    };
    hot = -1;
    open = true;
    if (focusFirst) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#library-fan a")?.focus(),
      );
    }
  }

  function hide() {
    open = false;
    hot = -1;
  }

  $effect(() => {
    void page.url.pathname;
    hide();
  });

  function onpointerdown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    tab = event.currentTarget as HTMLElement;
    drag = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      moved: false,
    };
    tab.setPointerCapture?.(event.pointerId);
  }

  function onpointermove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (
        Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START
      )
        return;
      drag.moved = true;
      show();
    }
    hot = fanHit(points, origin, { x: event.clientX, y: event.clientY });
  }

  function onpointerup(event: PointerEvent) {
    const ended = drag;
    if (!ended || event.pointerId !== ended.id) return;
    drag = null;
    if (!ended.moved) return;
    // The lift that picked a domain isn't also a tap on the tab.
    swallowClick = true;
    setTimeout(() => (swallowClick = false));
    const picked = domains[hot];
    hide();
    if (picked) void goto(picked.href);
  }

  function onpointercancel() {
    if (drag?.moved) hide();
    drag = null;
  }

  function onclick(event: MouseEvent) {
    if (swallowClick) return;
    tab = event.currentTarget as HTMLElement;
    if (open) hide();
    else show(event.detail === 0);
  }

  function pick(event: MouseEvent, domain: MobileDestination) {
    scrollUpOnReselect(event, domain.href, page.url);
    hide();
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") {
      hide();
      tab?.focus();
    }
  }} />

{#if single}
  <NavTab
    href={single.href}
    icon={single.icon}
    label={single.label}
    active={!!current}
    {look} />
{:else if domains.length > 1}
  <NavTab
    icon={current?.icon ?? "library"}
    label={current?.label ?? m.common_library()}
    ariaLabel={current
      ? m.nav_library_current({ domain: current.label })
      : m.nav_library_choose()}
    active={!!current}
    {look}
    data-no-menu-pull
    aria-haspopup="true"
    aria-expanded={open}
    aria-controls="library-fan"
    style="touch-action: none"
    {onclick}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    {onpointercancel}>
    {#snippet badge()}
      {#if isFeatureNew("phone-navigation") && !open}
        <span
          class="bg-accent ring-surface absolute top-0 right-0 h-2 w-2 rounded-full ring-2"
          aria-hidden="true"></span>
      {/if}
    {/snippet}
  </NavTab>
{/if}

{#if open}
  <div use:portal class="contents" data-library-fan>
    <button
      type="button"
      tabindex="-1"
      aria-label={m.common_close()}
      class="fixed inset-0 z-[29] bg-black/45"
      transition:fade|global={{ duration: reduced ? 0 : 180 }}
      onclick={hide}></button>
    <ul id="library-fan" aria-label={m.common_libraries()} class="contents">
      {#each domains as domain, i (domain.id)}
        {@const point = points[i]}
        {@const here = current?.id === domain.id}
        <li class="contents">
          <a
            href={domain.href}
            aria-current={here ? "page" : undefined}
            onclick={(event) => pick(event, domain)}
            class="group fixed z-[31] flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 outline-none"
            style="left: {origin.x + point.dx}px; top: {origin.y +
              point.dy}px; --domain: {tint(domain)}"
            in:fanBurst|global={{
              dx: point.dx,
              dy: point.dy,
              delay: i * 25,
              reduced,
            }}
            out:fanBurst|global={{ dx: point.dx, dy: point.dy, reduced }}>
            <span
              class="group-focus-visible:outline-accent grid size-14 place-items-center rounded-full border-2 border-(--domain) shadow-lg outline-offset-2 transition-[background-color,color,scale] duration-150 group-focus-visible:outline-2 {hot ===
              i
                ? 'scale-110 bg-(--domain) text-(--surface)'
                : here
                  ? 'bg-surface-2 text-(--domain)'
                  : 'bg-surface text-(--domain) group-active:bg-(--domain) group-active:text-(--surface)'}">
              <Icon name={domain.icon} class="h-6 w-6" />
            </span>
            <span
              class="text-xs font-bold whitespace-nowrap text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.75)]"
              >{domain.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}
