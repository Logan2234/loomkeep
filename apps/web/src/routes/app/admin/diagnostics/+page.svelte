<script lang="ts">
  // Measures and vibrations on the phone itself, for what only shows there
  // (the band above the keyboard, a silent vibration) when no debugger can be
  // attached.
  import PageHeader from "#lib/components/PageHeader.svelte";
  import {
    nativeDiagnostics,
    runProbe,
    VIBRATION_PROBES,
    type ProbeResult,
    type VibrationProbe,
  } from "#lib/native/diagnostics.js";
  import { m } from "#lib/paraglide/messages.js";

  const REFRESH_MS = 500;

  let web = $state<Record<string, unknown>>({});
  let native = $state<Record<string, unknown> | null>(null);
  let results = $state<Record<string, ProbeResult>>({});
  let copied = $state(false);

  function measure() {
    web = {
      innerHeight,
      visualViewport: visualViewport?.height,
      clientHeight: document.documentElement.clientHeight,
      screenHeight: screen.height,
      devicePixelRatio,
      keyboardOpen:
        document.documentElement.classList.contains("keyboard-open"),
      focus: document.activeElement?.tagName,
    };
    void nativeDiagnostics()?.then((info) => (native = info));
  }

  $effect(() => {
    measure();
    const timer = setInterval(measure, REFRESH_MS);
    return () => clearInterval(timer);
  });

  async function vibrate(probe: VibrationProbe) {
    results[probe.id] = await runProbe(probe);
  }

  async function copy() {
    await navigator.clipboard.writeText(
      JSON.stringify({ web, native, vibrations: results }, null, 1),
    );
    copied = true;
  }
</script>

<!-- What the page covers: anything outside this frame isn't the page's. -->
<div
  class="pointer-events-none fixed inset-0 z-60 border-4 border-fuchsia-500"
  aria-hidden="true">
</div>

<div>
  <PageHeader
    icon="activity"
    title={m.admin_diagnostics_title()}
    subtitle={m.admin_diagnostics_subtitle()}
    back="/app/admin"
    class="mb-6" />

  <div class="space-y-4">
    <section class="card space-y-3 p-4">
      <h2 class="font-semibold">{m.admin_diagnostics_keyboard()}</h2>
      <p class="text-dim text-sm">{m.admin_diagnostics_keyboard_hint()}</p>
      <input
        type="text"
        name="diagnosticsField"
        class="input text-sm"
        aria-label={m.admin_diagnostics_keyboard()} />
      <dl class="font-mono text-xs">
        {#each Object.entries({ ...web, ...native }) as [name, value] (name)}
          <div class="flex justify-between gap-4 py-0.5">
            <dt class="text-dim">{name}</dt>
            <dd class="text-right">{String(value)}</dd>
          </div>
        {/each}
      </dl>
    </section>

    <section class="card space-y-3 p-4">
      <h2 class="font-semibold">{m.admin_diagnostics_vibrations()}</h2>
      <p class="text-dim text-sm">{m.admin_diagnostics_vibrations_hint()}</p>
      <ul class="space-y-2">
        {#each VIBRATION_PROBES as probe (probe.id)}
          <li class="flex items-center justify-between gap-3">
            <button
              type="button"
              class="btn btn-ghost btn-sm font-mono text-xs"
              onclick={() => vibrate(probe)}>
              {probe.id}
            </button>
            <span class="min-w-0 text-right font-mono text-xs break-words">
              {results[probe.id] ?? ""}
            </span>
          </li>
        {/each}
      </ul>
    </section>

    <button type="button" class="btn btn-primary" onclick={copy}>
      {copied ? m.admin_diagnostics_copied() : m.common_copy()}
    </button>
  </div>
</div>
