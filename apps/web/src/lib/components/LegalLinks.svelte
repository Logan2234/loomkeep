<script lang="ts">
  import { getAdminVersion } from "$lib/api/admin";
  import { auth } from "$lib/auth.svelte";
  import { m } from "$lib/paraglide/messages";
  import { CHANGELOG_URL } from "../constants/external-links";

  // AdminOnly on the backend — only fetched (and shown) for the admin account.
  let version = $state<string | null>(null);

  $effect(() => {
    if (auth.isAdmin) {
      getAdminVersion()
        .then((v) => (version = v.version))
        .catch(() => {});
    }
  });
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

  {#if version}
    <a
      href={CHANGELOG_URL}
      target="_blank"
      rel="noopener noreferrer"
      class="btn-text font-normal">
      {m.common_version({ version })}
    </a>
  {/if}
</footer>
