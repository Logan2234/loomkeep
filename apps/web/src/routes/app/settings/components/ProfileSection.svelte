<script lang="ts">
  // Identity fields (avatar, nom affiché, bio) moved to /profile — edited
  // right where they're shown, via the pencil/camera buttons on the profile
  // header. What's left here isn't "profile" content in the sense that
  // anyone else ever sees it — it's account-level content filtering.
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import SettingRow from "./SettingRow.svelte";

  let birthDate = $state(auth.user?.birthDate ?? "");

  // Today, formatted for the date input's `max` bound (no future birth dates).
  const todayIso = new Date().toISOString().slice(0, 10);

  const saveBirthDateMut = createApiMutation(() => ({
    mutate: () => updateMe({ birthDate: birthDate || null }),
    coveredFields: ["birthDate"],
  }));

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

  const toggleAdultContentMut = createApiMutation(() => ({
    mutate: (allowAdultContent: boolean) => updateMe({ allowAdultContent }),
  }));

  function toggleAdultContent() {
    if (!auth.user || !isAdultEligible) return;
    toggleAdultContentMut.mutate(!auth.user.allowAdultContent);
  }
</script>

{#if auth.user}
  {@const user = auth.user}
  <section class="card p-5 md:p-6">
    <div class="divide-border divide-y">
      <SettingRow
        label={m.common_birthdate()}
        description={m.settings_birthdate_description()}
        controlId="settings-birth-date"
        mutation={saveBirthDateMut}>
        {#snippet control()}
          <input
            type="date"
            id="settings-birth-date"
            name="birthDate"
            autocomplete="bday"
            class="input w-auto"
            max={todayIso}
            aria-describedby="settings-birth-date-description"
            bind:value={birthDate}
            onchange={() => saveBirthDateMut.mutate()} />
        {/snippet}
      </SettingRow>

      {#if isAdultEligible}
        <SettingRow
          label={m.settings_adult_content_label()}
          description={m.settings_adult_content_description()}
          mutation={toggleAdultContentMut}>
          {#snippet control()}
            <Switch
              label={m.settings_adult_content_label()}
              checked={user.allowAdultContent}
              onChange={toggleAdultContent} />
          {/snippet}
        </SettingRow>
      {/if}
    </div>
  </section>
{/if}
