<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  // Each app shell (sidebar, dock, board, mobile) renders its own <main>, so
  // the target is found at click time rather than through a shared id.
  function skip(event: MouseEvent) {
    const main = document.querySelector("main");
    if (!main) return;
    event.preventDefault();
    main.tabIndex = -1;
    main.focus();
  }
</script>

<a
  href="#main"
  onclick={skip}
  class="btn btn-primary sr-only transition-opacity duration-150 focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.75rem)] focus:left-3 focus:z-100">
  {m.common_skip_to_content()}
</a>
