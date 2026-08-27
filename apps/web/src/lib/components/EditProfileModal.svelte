<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { UserDto } from "@loomkeep/shared";
  import Modal from "./Modal.svelte";

  let {
    displayName: initialDisplayName,
    bio: initialBio,
    onSaved,
    onclose,
  }: {
    displayName: string;
    bio: string | null;
    onSaved: (user: UserDto) => void;
    onclose: () => void;
  } = $props();

  let displayName = $state(initialDisplayName);
  let bio = $state(initialBio ?? "");
  let busy = $state(false);
  let error = $state("");

  async function save() {
    const trimmedName = displayName.trim();
    if (!trimmedName || busy) return;
    busy = true;
    error = "";
    try {
      const user = await updateMe({
        displayName: trimmedName,
        bio: bio.trim() || null,
      });
      onSaved(user);
      onclose();
    } catch (err) {
      error = resolveApiError(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Modifier le profil" {onclose}>
  <div class="flex flex-col gap-4">
    <label class="block">
      <span class="mb-1.5 block text-sm font-semibold">Nom affiché</span>
      <input
        type="text"
        class="input"
        maxlength="50"
        bind:value={displayName} />
    </label>

    {#if appConfig.socialEnabled}
      <label class="block">
        <span class="mb-1.5 block text-sm font-semibold">Bio</span>
        <textarea
          class="input min-h-20 resize-y"
          maxlength="500"
          placeholder="Quelques mots sur vous, affichés sur votre profil…"
          bind:value={bio}></textarea>
      </label>
    {/if}

    {#if error}
      <p class="text-danger text-sm">{error}</p>
    {/if}

    <button
      class="btn btn-primary w-full"
      disabled={busy || !displayName.trim()}
      onclick={save}>
      {m.common_save()}
    </button>
  </div>
</Modal>
