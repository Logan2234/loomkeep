<script lang="ts">
  import { updateMe } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import Switch from "#lib/components/Switch.svelte";
  import { appConfig } from "#lib/config.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import SettingRow from "../components/SettingRow.svelte";
  import SettingsSection from "../components/SettingsSection.svelte";

  const presenceMut = createApiMutation(() => ({
    mutate: (chatShowPresence: boolean) => updateMe({ chatShowPresence }),
    errorToast: true,
  }));

  const readReceiptsMut = createApiMutation(() => ({
    mutate: (chatShowReadReceipts: boolean) =>
      updateMe({ chatShowReadReceipts }),
    errorToast: true,
  }));
</script>

<SettingsSection slug="messages">
  {#if appConfig.chatEnabled && auth.user}
    {@const user = auth.user}
    <section class="card p-5 md:p-6">
      <div class="divide-border divide-y">
        <SettingRow
          anchor="chat-presence"
          label={m.settings_chat_presence()}
          description={m.settings_chat_presence_desc()}
          mutation={presenceMut}>
          {#snippet control()}
            <Switch
              label={m.settings_chat_presence()}
              checked={user.chatShowPresence}
              onChange={(value) => presenceMut.mutate(value)} />
          {/snippet}
        </SettingRow>
        <SettingRow
          anchor="chat-read-receipts"
          label={m.settings_chat_read_receipts()}
          description={m.settings_chat_read_receipts_desc()}
          mutation={readReceiptsMut}>
          {#snippet control()}
            <Switch
              label={m.settings_chat_read_receipts()}
              checked={user.chatShowReadReceipts}
              onChange={(value) => readReceiptsMut.mutate(value)} />
          {/snippet}
        </SettingRow>
      </div>
    </section>
  {/if}
</SettingsSection>
