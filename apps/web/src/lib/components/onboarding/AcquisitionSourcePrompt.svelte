<script lang="ts">
  import { setAcquisitionSource } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import {
    ACQUISITION_SOURCE_LABELS,
    acquisitionSourceOrder,
  } from "#lib/constants/acquisition-sources.js";
  import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
  import {
    readSessionStorage,
    writeSessionStorage,
  } from "#lib/local-storage.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { tapFeedback } from "#lib/native/haptics.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    ACQUISITION_SOURCE_OTHER_MAX_LENGTH,
    AcquisitionSource,
    type SetAcquisitionSourceRequestDto,
  } from "@loomkeep/shared";
  import { fade, slide } from "svelte/transition";
  import Icon from "../Icon.svelte";

  const reduced = prefersReducedMotion();

  const order = acquisitionSourceOrder(
    readSessionStorage(STORAGE_KEYS.acquisitionSourceOrder),
  );
  writeSessionStorage(
    STORAGE_KEYS.acquisitionSourceOrder,
    order.slice(0, -1).join(","),
  );

  let picked = $state<AcquisitionSource | null>(null);
  let other = $state("");

  const saveMut = createApiMutation(() => ({
    mutate: (body: SetAcquisitionSourceRequestDto) =>
      setAcquisitionSource(body),
  }));

  // "Other" waits for its text: the answer can only be written once.
  function pick(source: AcquisitionSource) {
    tapFeedback();
    picked = source;
    if (source !== AcquisitionSource.OTHER) saveMut.mutate({ source });
  }

  function sendOther(event: SubmitEvent) {
    event.preventDefault();
    const text = other.trim();
    saveMut.mutate({
      source: AcquisitionSource.OTHER,
      ...(text && { other: text }),
    });
  }
</script>

<section class="mt-6 max-w-xl" aria-labelledby="acquisition-title">
  {#if saveMut.data}
    <p
      class="text-dim flex items-center gap-2 text-sm"
      role="status"
      in:fade={{ duration: reduced ? 0 : 200 }}>
      <Icon name="check" class="text-accent h-4 w-4 shrink-0" />
      {m.onboarding_acquisition_thanks()}
    </p>
  {:else}
    <h3
      id="acquisition-title"
      class="font-display mb-0.5 text-lg font-extrabold">
      {m.onboarding_acquisition_title()}
    </h3>
    <p class="text-dim mb-3 text-sm">{m.common_optional()}</p>
    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-labelledby="acquisition-title">
      {#each order as source (source)}
        <button
          type="button"
          class="chip"
          class:chip-on={picked === source}
          aria-pressed={picked === source}
          disabled={saveMut.loading}
          onclick={() => pick(source)}>
          {ACQUISITION_SOURCE_LABELS[source]()}
        </button>
      {/each}
    </div>
    {#if picked === AcquisitionSource.OTHER}
      <form
        class="mt-3 flex flex-col gap-1.5"
        transition:slide={{ duration: reduced ? 0 : 200 }}
        onsubmit={sendOther}>
        <label for="acquisition-other" class="text-sm font-semibold">
          {m.onboarding_acquisition_other_label()}
        </label>
        <div class="flex gap-2">
          <input
            id="acquisition-other"
            class="input min-w-0 flex-1"
            maxlength={ACQUISITION_SOURCE_OTHER_MAX_LENGTH}
            placeholder={m.onboarding_acquisition_other_placeholder()}
            bind:value={other} />
          <button
            type="submit"
            class="btn btn-ghost shrink-0"
            disabled={saveMut.loading}>
            {m.common_send()}
          </button>
        </div>
      </form>
    {/if}
    {#if saveMut.error}
      <p class="text-danger mt-2 text-sm" role="alert">{saveMut.error}</p>
    {/if}
  {/if}
</section>
