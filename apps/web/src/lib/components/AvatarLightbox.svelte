<script lang="ts">
  import LightboxFrame from "#lib/components/LightboxFrame.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { scale } from "svelte/transition";
  import Avatar from "./Avatar.svelte";

  let {
    seed,
    url = null,
    onClose,
  }: { seed: string; url?: string | null; onClose: () => void } = $props();

  const reduced = prefersReducedMotion();
</script>

<LightboxFrame label={m.profile_avatar_large()} {onClose}>
  <button
    type="button"
    class="relative z-10 cursor-zoom-out"
    in:scale={{ start: 0.96, duration: reduced ? 0 : 180 }}
    out:scale={{ start: 0.96, duration: reduced ? 0 : 140 }}
    aria-label={m.profile_avatar_reduce()}
    onclick={onClose}>
    <div class="pointer-events-none">
      <Avatar {seed} {url} size={280} />
    </div>
  </button>
</LightboxFrame>
