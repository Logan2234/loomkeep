<script lang="ts">
  import { API_URL } from "$lib/api/core";
  import { m } from "$lib/paraglide/messages.js";

  // Falls back to a deterministic identicon generated from a username when
  // no `url` (uploaded profile picture) is given. Séance-restrained: a single
  // per-user hue (not a rainbow), a symmetric 5×5 pattern rendered as a tiny
  // "film cell". The hue reads on both themes; the frame uses theme-aware
  // surface tokens.
  let {
    seed,
    url = null,
    size = 40,
    class: cls = "",
  }: {
    seed: string;
    /** Relative path from `UserSummaryDto`/`UserDto.avatarUrl` (e.g. `/users/:id/avatar?v=…`). */
    url?: string | null;
    size?: number;
    class?: string;
  } = $props();

  // djb2 → unsigned 32-bit. Stable across sessions for the same username.
  function hash(value: string): number {
    let h = 5381;
    for (let i = 0; i < value.length; i++) {
      h = ((h << 5) + h) ^ value.charCodeAt(i);
    }
    return h >>> 0;
  }

  let h = $derived(hash(seed || "?"));
  // Single hue, held to a calm saturation/lightness so avatars feel tinted, not
  // loud — the same discipline as the single ambre accent.
  let fill = $derived(`hsl(${h % 360} 52% 52%)`);

  // 5×5 grid mirrored across the vertical axis → 15 independent cells (bits).
  let cells = $derived.by(() => {
    const rects: { x: number; y: number }[] = [];
    let bit = 0;
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 5; y++) {
        if ((h >> bit) & 1) {
          rects.push({ x, y });
          if (x < 2) rects.push({ x: 4 - x, y }); // mirror
        }
        bit++;
      }
    }
    return rects;
  });
</script>

<span
  class="bg-surface-2 border-border/60 inline-block shrink-0 overflow-hidden rounded-md border {cls}"
  style="width:{size}px;height:{size}px"
  role="img"
  aria-label={m.avatar_alt({ seed })}>
  {#if url}
    <img
      src="{API_URL}{url}"
      alt=""
      width={size}
      height={size}
      class="h-full w-full object-cover" />
  {:else}
    <svg
      viewBox="-0.4 -0.4 5.8 5.8"
      width={size}
      height={size}
      aria-hidden="true">
      {#each cells as cell (cell.x + "-" + cell.y)}
        <rect x={cell.x} y={cell.y} width="1" height="1" {fill} />
      {/each}
    </svg>
  {/if}
</span>
