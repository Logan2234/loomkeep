<script lang="ts">
  // Identity fields (avatar, nom affiché, bio) moved to /profile — edited
  // right where they're shown, via the pencil/camera buttons on the profile
  // header. What's left here isn't "profile" content in the sense that
  // anyone else ever sees it — it's account-level content filtering.
  import { updateMe } from "$lib/api/client";
  import { resolveApiError } from "$lib/api/errors";
  import { auth } from "$lib/auth.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";

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
      birthDateError = resolveApiError(err);
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
      adultContentError = resolveApiError(err);
    }
  }
</script>

{#if auth.user}
  <section class="card mb-5 p-5 md:p-6">
    <h2 class="font-display mb-4 text-lg font-bold">Contenu</h2>

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
      <p class="text-dim mt-2 text-sm">
        {m.common_save_loading()}
      </p>
    {:else if birthDateStatus === "saved"}
      <p class="text-success mt-2 text-sm">Enregistré.</p>
    {:else if birthDateStatus === "error"}
      <p class="text-danger mt-2 text-sm">{birthDateError}</p>
    {/if}

    {#if isAdultEligible}
      <div class="border-border mt-5 border-t pt-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-semibold">Contenu pour adultes</p>
            <p class="text-dim text-sm">
              Inclut les titres 18+ (hentai, films pornographiques) dans les
              recherches.
            </p>
          </div>
          <Switch
            label="Contenu pour adultes"
            checked={auth.user.allowAdultContent}
            onChange={toggleAdultContent} />
        </div>
        {#if adultContentError}
          <p class="text-danger mt-2 text-sm">{adultContentError}</p>
        {/if}
      </div>
    {/if}
  </section>
{/if}
