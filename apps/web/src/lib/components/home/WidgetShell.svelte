<script lang="ts">
  // A home widget's card: icon, title, an optional "see all" link, and the
  // body the widget lays out in. The header's height is fixed — sizing.ts
  // subtracts it to know the room the body has.
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import type { Snippet } from "svelte";

  let {
    icon,
    title,
    href,
    linkLabel,
    tag,
    children,
  }: {
    icon: IconName;
    title: string;
    href?: string;
    linkLabel?: string;
    /** What the numbers cover — a month, a date — in the timecode voice. */
    tag?: string;
    children: Snippet;
  } = $props();
</script>

<section class="card flex h-full flex-col overflow-hidden p-4">
  <div class="mb-3 flex h-6 shrink-0 items-center justify-between gap-2">
    <h2
      class="font-display flex min-w-0 items-center gap-2 text-base font-bold">
      <Icon name={icon} class="text-accent h-4 w-4 shrink-0" />
      <span class="truncate">{title}</span>
      {#if tag}
        <span class="timecode shrink-0 text-[0.65rem] font-normal uppercase">
          {tag}
        </span>
      {/if}
    </h2>
    {#if href}
      <a {href} class="btn-text group shrink-0">
        {linkLabel ?? m.common_see()}
        <Icon
          name="arrow-right"
          class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>
    {/if}
  </div>
  <div class="min-h-0 flex-1">
    {@render children()}
  </div>
</section>
