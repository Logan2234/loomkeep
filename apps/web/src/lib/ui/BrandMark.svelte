<script lang="ts">
  let { class: cls = "" }: { class?: string } = $props();
</script>

<!-- The mark without its tile (static/favicon.svg), as the Android launch
     screen draws it. -->
<svg viewBox="0 0 100 100" class={cls} aria-hidden="true">
  <g stroke-width="14" stroke-linecap="round">
    <line x1="16" y1="12" x2="16" y2="88" stroke="#d6a02a" />
    <line x1="36" y1="12" x2="36" y2="88" stroke="#1f9dae" />
    <line x1="56" y1="12" x2="56" y2="88" stroke="#d866a0" />
    <line x1="76" y1="12" x2="76" y2="88" stroke="#6e97e0" />
    <line x1="8" y1="30" x2="92" y2="30" stroke="#f5b841" />
    <line x1="36" y1="23" x2="36" y2="37" stroke="#1f9dae" />
    <line x1="76" y1="23" x2="76" y2="37" stroke="#6e97e0" />
  </g>
</svg>
