<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
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

  const saveMut = createApiMutation(() => ({
    mutate: () =>
      updateMe({ displayName: displayName.trim(), bio: bio.trim() || null }),
    coveredFields: ["displayName", "bio"],
    onSuccess: (user) => {
      onSaved(user);
      onclose();
    },
  }));

  function save() {
    if (!displayName.trim() || saveMut.loading) return;
    saveMut.mutate();
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

    {#if saveMut.error}
      <p class="text-danger text-sm">{saveMut.error}</p>
    {/if}

    <button
      class="btn btn-primary w-full"
      disabled={saveMut.loading || !displayName.trim()}
      onclick={save}>
      {m.common_save()}
    </button>
  </div>
</Modal>
