<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import {
    ALERTS,
    type AlertDefinition,
    type AlertKey,
    isAlertEnabled,
    isAlertToggleable,
  } from "@loomkeep/shared";
  import SettingRow from "../components/SettingRow.svelte";

  type Channel = "push" | "email";

  let {
    anchor,
    title,
    description,
    alerts,
    columns,
    hint,
  }: {
    anchor: string;
    title: string;
    description: string;
    alerts: { key: AlertKey; label: string; hint?: string }[];
    /** The bell column only shows for in-app alerts; the others are switches. */
    columns: ("bell" | Channel)[];
    /** Shown under the grid, e.g. when push is off on this device. */
    hint?: string | null;
  } = $props();

  const COLUMN_LABELS = {
    bell: m.settings_communications_bell(),
    push: m.settings_communications_push(),
    email: m.common_email(),
  };

  const mutation = createApiMutation(() => ({
    mutate: (change: { key: AlertKey; channel: Channel; value: boolean }) =>
      updateMe({
        alertPrefs: { [change.key]: { [change.channel]: change.value } },
      }),
  }));
</script>

<SettingRow {anchor} label={title} {description} {mutation}>
  <div
    class="mt-3 grid grid-cols-[minmax(0,1fr)_repeat(var(--cols),4.5rem)] items-center text-sm"
    style:--cols={columns.length}>
    <span></span>
    {#each columns as column (column)}
      <span class="text-dim pb-1 text-center text-xs">
        {COLUMN_LABELS[column]}
      </span>
    {/each}

    {#each alerts as alert (alert.key)}
      <div class="border-border border-t py-2.5 pr-2">
        {alert.label}
        {#if alert.hint}
          <span class="text-dim block text-xs">{alert.hint}</span>
        {/if}
      </div>
      {#each columns as column (column)}
        <div class="border-border flex justify-center border-t py-2.5">
          {#if column === "bell"}
            {#if (ALERTS[alert.key] as AlertDefinition).bell}
              <span title={m.settings_communications_always()}>
                <Icon name="check" class="text-dim h-4 w-4" />
                <span class="sr-only">{m.settings_communications_always()}</span>
              </span>
            {/if}
          {:else if isAlertToggleable(alert.key, column)}
            <Switch
              label="{alert.label} · {COLUMN_LABELS[column]}"
              checked={isAlertEnabled(auth.user?.alertPrefs, alert.key, column)}
              onChange={(value) =>
                mutation.mutate({ key: alert.key, channel: column, value })} />
          {:else}
            <span class="text-dim" aria-hidden="true">—</span>
          {/if}
        </div>
      {/each}
    {/each}
  </div>
  {#if hint}
    <p class="text-dim mt-2 text-xs">{hint}</p>
  {/if}
</SettingRow>
