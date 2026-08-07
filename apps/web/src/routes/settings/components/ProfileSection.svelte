<script lang="ts">
  import {
    ApiError,
    deleteAvatar,
    updateMe,
    uploadAvatar,
  } from "$lib/api/client";
  import { auth } from "$lib/auth.svelte";
  import Avatar from "$lib/components/Avatar.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ShareProfileModal from "$lib/components/ShareProfileModal.svelte";
  import { shareProfile as shareProfileNative } from "$lib/share-profile";
  import Switch from "$lib/components/Switch.svelte";
  import { appConfig } from "$lib/config.svelte";
  import type { UploadAvatarRequestDto } from "@loomkeep/shared";

  // Uploaded avatars are stored as-is server-side (no processing there), so
  // the client resizes to a square before sending — keeps the request small
  // and every avatar the same aspect ratio regardless of the source photo.
  const AVATAR_SIZE = 512;

  let avatarInput: HTMLInputElement | undefined = $state();
  let avatarStatus = $state<"idle" | "saving" | "error">("idle");
  let avatarError = $state("");

  async function resizeToSquare(file: File): Promise<{
    mimeType: string;
    data: string;
  }> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non supporté");

    // Center-crop to a square, then scale down to AVATAR_SIZE.
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );

    const dataUrl = canvas.toDataURL("image/webp", 0.85);
    const [header, data] = dataUrl.split(",");
    const mimeType = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
    return { mimeType, data };
  }

  async function onAvatarSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    avatarStatus = "saving";
    avatarError = "";

    try {
      const { mimeType, data } = await resizeToSquare(file);
      await uploadAvatar({
        mimeType: mimeType as UploadAvatarRequestDto["mimeType"],
        data,
      });
      avatarStatus = "idle";
    } catch (err) {
      avatarStatus = "error";
      avatarError =
        err instanceof ApiError ? err.message : "Envoi de l'image impossible";
    } finally {
      if (avatarInput) avatarInput.value = "";
    }
  }

  async function removeAvatar() {
    avatarStatus = "saving";
    avatarError = "";
    try {
      await deleteAvatar();
      avatarStatus = "idle";
    } catch (err) {
      avatarStatus = "error";
      avatarError =
        err instanceof ApiError ? err.message : "Suppression impossible";
    }
  }

  let displayNameInput = $state(auth.user?.displayName ?? "");
  let displayNameStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let displayNameError = $state("");

  async function saveDisplayName() {
    const value = displayNameInput.trim();
    if (!value || value === auth.user?.displayName) return;
    displayNameStatus = "saving";
    displayNameError = "";
    try {
      await updateMe({ displayName: value });
      displayNameStatus = "saved";
      // Clear the "Enregistré." hint after a moment so it doesn't linger.
      setTimeout(() => {
        if (displayNameStatus === "saved") displayNameStatus = "idle";
      }, 2500);
    } catch (err) {
      displayNameStatus = "error";
      displayNameError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  let bioInput = $state(auth.user?.bio ?? "");
  let bioStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let bioError = $state("");

  async function saveBio() {
    const value = bioInput.trim();
    if (value === (auth.user?.bio ?? "")) return;
    bioStatus = "saving";
    bioError = "";
    try {
      await updateMe({ bio: value || null });
      bioStatus = "saved";
      setTimeout(() => {
        if (bioStatus === "saved") bioStatus = "idle";
      }, 2500);
    } catch (err) {
      bioStatus = "error";
      bioError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  let birthDate = $state(auth.user?.birthDate ?? "");
  let birthDateStatus = $state<"idle" | "saving" | "saved" | "error">("idle");
  let birthDateError = $state("");

  // Today, formatted for the date input's `max` bound (no future birth dates).
  const todayIso = new Date().toISOString().slice(0, 10);

  async function saveBirthDate() {
    birthDateStatus = "saving";
    birthDateError = "";
    try {
      await updateMe({ birthDate: birthDate || null });
      birthDateStatus = "saved";
      setTimeout(() => {
        if (birthDateStatus === "saved") birthDateStatus = "idle";
      }, 2500);
    } catch (err) {
      birthDateStatus = "error";
      birthDateError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  // Mirrors the API's age check, just for enabling/disabling the toggle below.
  function hasTurned18(isoBirthDate: string | null): boolean {
    if (!isoBirthDate) return false;
    const [year, month, day] = isoBirthDate.split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const hadBirthdayThisYear =
      today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!hadBirthdayThisYear) age -= 1;
    return age >= 18;
  }

  let isAdultEligible = $derived(hasTurned18(auth.user?.birthDate ?? null));
  let adultContentError = $state("");

  async function toggleAdultContent() {
    if (!auth.user || !isAdultEligible) return;
    adultContentError = "";
    try {
      await updateMe({ allowAdultContent: !auth.user.allowAdultContent });
    } catch (err) {
      adultContentError =
        err instanceof ApiError ? err.message : "Enregistrement impossible";
    }
  }

  let shareModalOpen = $state(false);

  async function shareProfile() {
    if (!auth.user) return;
    const handled = await shareProfileNative(
      auth.user.username,
      auth.user.displayName,
    );
    if (!handled) shareModalOpen = true;
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 text-lg font-bold">Profil</h2>

    <div class="mb-5 flex items-center gap-4">
      <Avatar seed={auth.user.username} url={auth.user.avatarUrl} size={72} />
      <div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-ghost btn-sm"
            disabled={avatarStatus === "saving"}
            onclick={() => avatarInput?.click()}>
            <Icon name="edit" class="h-4 w-4" />
            Changer la photo
          </button>
          {#if auth.user.avatarUrl}
            <button
              class="btn btn-ghost btn-sm"
              disabled={avatarStatus === "saving"}
              onclick={removeAvatar}>
              <Icon name="trash" class="h-4 w-4" />
              Retirer
            </button>
          {/if}
        </div>
        <input
          bind:this={avatarInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="hidden"
          onchange={onAvatarSelected} />
        {#if avatarStatus === "error"}
          <p class="text-danger mt-1.5 text-xs">{avatarError}</p>
        {/if}
      </div>
    </div>

    <label class="block max-w-xs">
      <span class="mb-1.5 block text-sm font-semibold">Nom affiché</span>
      <input
        type="text"
        class="input"
        maxlength="50"
        bind:value={displayNameInput}
        onchange={saveDisplayName} />
    </label>
    {#if displayNameStatus === "saving"}
      <p class="text-dim mt-2 text-sm">Enregistrement…</p>
    {:else if displayNameStatus === "saved"}
      <p class="text-success mt-2 text-sm">Enregistré.</p>
    {:else if displayNameStatus === "error"}
      <p class="text-danger mt-2 text-sm">{displayNameError}</p>
    {/if}

    {#if appConfig.socialEnabled}
      <!-- Bio only matters when there are profiles for others to read it. -->
      <div class="border-border mt-5 border-t pt-5">
        <label class="block">
          <span class="mb-1.5 block text-sm font-semibold">Bio</span>
          <textarea
            class="input min-h-20 max-w-md resize-y"
            maxlength="500"
            placeholder="Quelques mots sur vous, affichés sur votre profil…"
            bind:value={bioInput}
            onchange={saveBio}></textarea>
        </label>
        {#if bioStatus === "saving"}
          <p class="text-dim mt-2 text-sm">Enregistrement…</p>
        {:else if bioStatus === "saved"}
          <p class="text-success mt-2 text-sm">Enregistré.</p>
        {:else if bioStatus === "error"}
          <p class="text-danger mt-2 text-sm">{bioError}</p>
        {/if}
      </div>
    {/if}

    <div class="border-border mt-5 border-t pt-5">
      <label class="block max-w-xs">
        <span class="mb-1.5 block text-sm font-semibold">
          Date de naissance
        </span>
        <input
          type="date"
          class="input"
          max={todayIso}
          bind:value={birthDate}
          onchange={saveBirthDate} />
      </label>
      <p class="text-dim mt-1.5 text-xs">
        Utilisée pour adapter certaines recommandations à ton âge.
      </p>
      {#if birthDateStatus === "saving"}
        <p class="text-dim mt-2 text-sm">Enregistrement…</p>
      {:else if birthDateStatus === "saved"}
        <p class="text-success mt-2 text-sm">Enregistré.</p>
      {:else if birthDateStatus === "error"}
        <p class="text-danger mt-2 text-sm">{birthDateError}</p>
      {/if}
    </div>

    <div class="border-border mt-5 border-t pt-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-semibold">Contenu pour adultes</p>
          <p class="text-dim text-sm">
            {#if isAdultEligible}
              Inclut les titres 18+ (hentai, films pornographiques) dans les
              recherches.
            {:else}
              Réservé aux comptes de 18 ans ou plus, date de naissance
              renseignée.
            {/if}
          </p>
        </div>
        <Switch
          label="Contenu pour adultes"
          checked={auth.user.allowAdultContent}
          disabled={!isAdultEligible}
          onChange={toggleAdultContent} />
      </div>
      {#if adultContentError}
        <p class="text-danger mt-2 text-sm">{adultContentError}</p>
      {/if}
    </div>

    <div class="border-border mt-5 border-t pt-5">
      <h2 class="font-semibold">Inviter des membres</h2>
      <p class="text-dim mb-4 text-sm">
        Il n'y a pas encore d'annuaire public — partagez le lien de votre profil
        pour que d'autres puissent vous suivre.
      </p>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost" onclick={shareProfile}>
          <Icon name="share" class="h-4 w-4" />
          Partager mon profil
        </button>
        <button class="btn btn-ghost" onclick={() => (shareModalOpen = true)}>
          <Icon name="qr-code" class="h-4 w-4" />
          QR code
        </button>
      </div>
    </div>
  </section>
{/if}

{#if shareModalOpen && auth.user}
  <ShareProfileModal
    username={auth.user.username}
    onclose={() => (shareModalOpen = false)} />
{/if}
