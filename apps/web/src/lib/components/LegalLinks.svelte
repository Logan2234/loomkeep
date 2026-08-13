<script lang="ts">
  import { appConfig } from "$lib/config.svelte";
  import { m } from "$lib/paraglide/messages";
  import { GITHUB_REPO_URL } from "../constants/external-links";
</script>

<footer
  class="border-border text-dim flex flex-col items-center gap-4 px-4 py-5 text-center text-xs">
  <nav
    aria-label="Informations légales"
    class="flex flex-wrap justify-center gap-y-1">
    <a
      href="/legal/legal-notice"
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal">Mentions légales</a>

    <span class="mx-1.5">·</span>

    <a
      href="/legal/privacy-policy"
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal">Confidentialité</a>

    <span class="mx-1.5">·</span>

    <a
      href="/legal/terms-of-service"
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal">CGU</a>
  </nav>

  {#if appConfig.version}
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal">
      {m.common_version({ version: appConfig.version })}
      {#if appConfig.gitSha && appConfig.gitSha !== "unknown"}
        <span class="opacity-60">({appConfig.gitSha})</span>
      {/if}
    </a>
  {/if}
</footer>
