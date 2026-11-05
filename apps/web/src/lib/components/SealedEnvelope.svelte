<script lang="ts">
  import BrandMark from "./BrandMark.svelte";
  import Icon from "./Icon.svelte";

  // The sign-up reward: a letter slides in, the flap closes, an amber seal
  // stamps it. One CSS timeline whose last frame is the resting state, so
  // reduced motion simply shows the sealed envelope.
  let { confirmed = false }: { confirmed?: boolean } = $props();
</script>

<div class="envelope" aria-hidden="true">
  <div class="back"></div>
  <div class="letter">
    <i class="w-2/5"></i><i></i><i class="w-3/4"></i><i></i>
  </div>
  <div class="front"></div>
  <div class="flap"></div>
  <div class="seal">
    {#if confirmed}
      <span class="contents"><Icon name="check" class="h-5 w-5" /></span>
    {:else}
      <BrandMark class="h-5 w-5" />
    {/if}
  </div>
</div>

<style>
  .envelope {
    --paper: #fffdf8;
    position: relative;
    width: 12.5rem;
    height: 8.25rem;
    perspective: 600px;
  }

  :global(.dark) .envelope {
    --paper: #f3ebd9;
  }

  .back,
  .front,
  .flap {
    position: absolute;
    inset: 0;
    border-radius: 0.5rem;
  }

  .back {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
  }

  .letter {
    position: absolute;
    inset: 0.75rem 0.875rem auto;
    height: 6.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.875rem 0.875rem 0;
    border-radius: 0.25rem;
    background: var(--paper);
    animation: letter-in 1.3s both;
  }

  .letter i {
    display: block;
    height: 0.375rem;
    border-radius: 0.2rem;
    background: #e4d9c2;
  }

  .letter i:first-child {
    background: #c9a35a;
  }

  /* Everything but the V the flap folds into. */
  .front {
    z-index: 2;
    background: var(--color-surface);
    box-shadow: inset 0 0 0 1px var(--color-border);
    clip-path: polygon(0 0, 50% 60%, 100% 0, 100% 100%, 0 100%);
  }

  /* The two creases of the V, which the flat fill alone loses. */
  .front::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--color-border);
    clip-path: polygon(
      0 0,
      50% 60%,
      100% 0,
      100% 2px,
      50% calc(60% + 2px),
      0 2px
    );
  }

  .flap {
    bottom: 32%;
    z-index: 3;
    background: color-mix(
      in oklab,
      var(--color-surface-2) 86%,
      var(--color-fg)
    );
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    transform-origin: top;
    filter: drop-shadow(0 1px 0 var(--color-border));
    animation: flap-close 1.3s both;
  }

  .seal {
    position: absolute;
    left: 50%;
    top: 66%;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    margin: -1.2rem 0 0 -1.2rem;
    border-radius: 50%;
    color: #4a3006;
    background: radial-gradient(
      circle at 35% 30%,
      #ffd27a,
      #e2a12a 55%,
      #b97c14
    );
    box-shadow:
      0 2px 6px rgb(0 0 0 / 0.25),
      inset 0 0 0 3px rgb(255 255 255 / 0.18);
    animation: seal-stamp 1.3s both;
  }

  @keyframes letter-in {
    0% {
      opacity: 0;
      transform: translateY(-4.5rem);
    }
    15% {
      opacity: 1;
      transform: translateY(-4.5rem);
    }
    50%,
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Open (and behind the letter) while it slides in, then folds over it. */
  @keyframes flap-close {
    0%,
    50% {
      z-index: 0;
      transform: rotateX(180deg);
      animation-timing-function: ease-in;
    }
    51% {
      z-index: 3;
    }
    74%,
    100% {
      z-index: 3;
      transform: rotateX(0deg);
    }
  }

  @keyframes seal-stamp {
    0%,
    74% {
      opacity: 0;
      transform: scale(1.8);
    }
    90% {
      opacity: 1;
      transform: scale(0.92);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .letter,
    .flap,
    .seal {
      animation: none;
    }
  }

  :global(.a11y-reduce-motion) .letter,
  :global(.a11y-reduce-motion) .flap,
  :global(.a11y-reduce-motion) .seal {
    animation: none;
  }
</style>
