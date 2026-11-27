<script lang="ts">
  // The menu's handle on a bottom bar: says the sheet can be pulled up from
  // here (see pull-menu.ts), and opens it on a tap.
  import { m } from "#lib/paraglide/messages.js";

  let { class: cls = "-top-2" }: { class?: string } = $props();
</script>

<button
  type="button"
  aria-label={m.nav_open_menu()}
  onclick={() => dispatchEvent(new CustomEvent("mobile-menu-toggle"))}
  class="group absolute left-1/2 z-10 grid h-4 w-16 -translate-x-1/2 place-items-center {cls}">
  <span
    class="bg-border group-hover:bg-dim group-active:bg-dim h-1 w-9 rounded-full transition-[width,background-color] duration-150 group-hover:w-11 group-active:w-11"
  ></span>
</button>
