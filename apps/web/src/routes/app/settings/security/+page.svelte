<script lang="ts">
  import AppLockSetting from "../components/AppLockSetting.svelte";
  import SettingsSection from "../components/SettingsSection.svelte";
  import SecuritySection from "../components/SecuritySection.svelte";
</script>

<SettingsSection slug="security">
  <SecuritySection />
  <AppLockSetting />
</SettingsSection>
