<script lang="ts" module>
  import { type AlertChannel } from "@loomkeep/shared";

  import type { AlertKey } from "@loomkeep/shared";

  export interface AlertGroupRows {
    /** Left out for a matrix short enough to need no sections. */
    label?: string;
    alerts: { key: AlertKey; label: string; hint?: string }[];
  }
</script>

<script lang="ts">
  import { updateMe } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import { auth } from "$lib/auth.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import type { IconName } from "$lib/types/icon-name";
  import {
    ALERTS,
    type AlertDefinition,
    isAlertEnabled,
    isAlertToggleable,
  } from "@loomkeep/shared";
  import type { Snippet } from "svelte";
  import SettingRow from "../components/SettingRow.svelte";

  let {
    anchor,
    title,
    description,
    groups,
    columns,
    pushBlocked = false,
    notice,
  }: {
    anchor: string;
    title: string;
    description: string;
    groups: AlertGroupRows[];
    columns: ("bell" | AlertChannel)[];
    /** No device receives push: the choices are kept, but can't take effect. */
    pushBlocked?: boolean;
    /** Shown above the matrix, e.g. where push currently arrives. */
    notice?: Snippet;
  } = $props();

  const COLUMNS: Record<
    "bell" | AlertChannel,
    { label: string; icon: IconName }
  > = {
    bell: { label: m.settings_communications_bell(), icon: "bell" },
    push: { label: m.settings_communications_push(), icon: "smartphone" },
    email: { label: m.common_email(), icon: "mail" },
  };

  const mutation = createApiMutation(() => ({
    mutate: (change: {
      key: AlertKey;
      channel: AlertChannel;
      value: boolean;
    }) =>
      updateMe({
        alertPrefs: { [change.key]: { [change.channel]: change.value } },
      }),
  }));
</script>

<SettingRow {anchor} label={title} {description} {mutation}>
  {@render notice?.()}
  <table class="mt-2 w-full table-fixed border-collapse text-sm">
    <colgroup>
      <col />
      {#each columns as column (column)}
        <col class="w-[4.25rem]" />
      {/each}
    </colgroup>
    <thead>
      <tr>
        <td></td>
        {#each columns as column (column)}
          <th
            scope="col"
            class="text-dim pb-1.5 text-center text-xs font-normal">
            <Icon name={COLUMNS[column].icon} class="mx-auto mb-0.5 h-4 w-4" />
            {COLUMNS[column].label}
          </th>
        {/each}
      </tr>
    </thead>
    {#each groups as group, index (group.label ?? index)}
      <tbody>
        {#if group.label}
          <tr>
            <th
              scope="rowgroup"
              colspan={columns.length + 1}
              class="text-accent pb-1 text-left font-mono text-[0.65rem] font-normal tracking-[0.12em] uppercase
                {index === 0 ? 'pt-1' : 'pt-4'}">
              <span class="flex items-center gap-2">
                {group.label}
                <span class="bg-border h-px flex-1" aria-hidden="true"></span>
              </span>
            </th>
          </tr>
        {/if}
        {#each group.alerts as alert (alert.key)}
          <tr class="border-border border-t">
            <th scope="row" class="py-3 pr-2 text-left font-normal">
              {alert.label}
              {#if alert.hint}
                <span class="text-dim block text-xs">{alert.hint}</span>
              {/if}
            </th>
            {#each columns as column (column)}
              <td class="py-3 text-center align-middle">
                {#if column === "bell"}
                  {#if (ALERTS[alert.key] as AlertDefinition).bell}
                    <span
                      class="text-dim inline-flex"
                      title={m.settings_communications_always()}>
                      <Icon name="check" class="h-4 w-4" />
                      <span class="sr-only">
                        {m.settings_communications_always()}
                      </span>
                    </span>
                  {/if}
                {:else if isAlertToggleable(alert.key, column)}
                  <span
                    class="inline-flex transition-opacity"
                    class:opacity-40={column === "push" && pushBlocked}>
                    <Switch
                      label="{alert.label} · {COLUMNS[column].label}"
                      checked={isAlertEnabled(
                        auth.user?.alertPrefs,
                        alert.key,
                        column,
                      )}
                      disabled={column === "push" && pushBlocked}
                      onChange={(value) =>
                        mutation.mutate({
                          key: alert.key,
                          channel: column,
                          value,
                        })} />
                  </span>
                {:else}
                  <span class="text-dim" aria-hidden="true">—</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>
</SettingRow>
