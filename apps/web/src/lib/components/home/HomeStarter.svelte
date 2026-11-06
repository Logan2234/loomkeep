<script lang="ts">
  import EmptyState from "#lib/components/EmptyState.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import { m } from "#lib/paraglide/messages.js";

  // A new account's home, until its first title: one screen to start from
  // instead of a column of empty widgets. The checklist step it hangs on is
  // pushed over the socket, so the real home takes over on its own.
</script>

<EmptyState art="projector" title={m.home_starter_title()} class="pt-4">
  <p class="text-sm">{m.home_starter_body()}</p>
  <div class="mt-5 flex w-full max-w-sm flex-col gap-2">
    <a href="/app/search" class="btn btn-primary h-12">
      <Icon name="search" class="h-4 w-4" />
      {m.home_starter_search()}
    </a>
    <a href="/app/settings/import" class="btn btn-ghost h-12">
      <Icon name="download" class="h-4 w-4" />
      {m.home_starter_import()}
    </a>
  </div>
</EmptyState>
