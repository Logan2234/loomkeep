<script lang="ts">
  // Shared footer for the five landing prototypes. The FR/EN switch is a
  // placement, not an implementation — see the note in the prototype index.
  import LegalLinks from "$lib/components/LegalLinks.svelte";
  import {
    CHANGELOG_URL,
    FEEDBACK_URL,
    GITHUB_REPO_URL,
  } from "$lib/constants/external-links";
</script>

<footer class="border-border border-t">
  <div
    class="text-dim mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 pt-6 text-xs">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="btn-text font-normal">GitHub</a>
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="btn-text font-normal">Suggestions &amp; bugs</a>
      <a
        href={CHANGELOG_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="btn-text font-normal">Notes de version</a>
    </div>
    <div
      class="border-border flex items-center gap-1 rounded-lg border p-0.5"
      role="group"
      aria-label="Langue">
      <span class="bg-surface-2 text-fg rounded-md px-2 py-1 font-mono text-xs"
        >FR</span>
      <span class="text-dim px-2 py-1 font-mono text-xs">EN</span>
    </div>
  </div>
  <LegalLinks />
</footer>
