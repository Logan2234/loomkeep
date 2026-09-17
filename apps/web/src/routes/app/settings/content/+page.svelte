<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Combobox from "$lib/components/Combobox.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { SpoilerSensitivity } from "@loomkeep/shared";
  import SettingRow from "../components/SettingRow.svelte";
  import SettingsSection from "../components/SettingsSection.svelte";

  const SPOILER_OPTIONS: { label: string; value: SpoilerSensitivity }[] = [
    { label: m.settings_spoiler_auto(), value: SpoilerSensitivity.AUTO },
    {
      label: m.settings_spoiler_always_hidden(),
      value: SpoilerSensitivity.ALWAYS_HIDDEN,
    },
    {
      label: m.settings_spoiler_always_revealed(),
      value: SpoilerSensitivity.ALWAYS_REVEALED,
    },
  ];

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

  const spoilerSensitivityMut = createApiMutation(() => ({
    mutate: (spoilerSensitivity: SpoilerSensitivity) =>
      updateMe({ spoilerSensitivity }),
  }));
</script>

<SettingsSection slug="content">
  {#if auth.user}
    {@const user = auth.user}
    <section class="card p-5 md:p-6">
      <div class="divide-border divide-y">
        <SettingRow
          anchor="birthdate"
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
            anchor="adult-content"
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

        <SettingRow
          anchor="spoiler-sensitivity"
          label={m.settings_spoiler_sensitivity_label()}
          description={m.settings_spoiler_sensitivity_description()}
          mutation={spoilerSensitivityMut}>
          {#snippet control()}
            <Combobox
              label={m.settings_spoiler_sensitivity_label()}
              options={SPOILER_OPTIONS}
              values={[user.spoilerSensitivity]}
              onChange={(v) =>
                spoilerSensitivityMut.mutate(v[0] as SpoilerSensitivity)} />
          {/snippet}
        </SettingRow>
      </div>
    </section>
  {/if}
</SettingsSection>
