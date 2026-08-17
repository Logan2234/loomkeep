<script lang="ts">
  import { API_URL } from "$lib/api/core";
  import Icon from "$lib/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<div class="mx-auto max-w-3xl px-5 py-6 md:px-8 md:py-10">
  <div class="mb-6 flex items-center gap-3">
    <a
      href="/app/settings/import"
      class="text-dim hover:text-fg"
      aria-label={m.common_back()}>
      <Icon name="chevron-left" class="h-5 w-5" />
    </a>
    <h1 class="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
      Import Simkl
    </h1>
  </div>

  <p class="text-dim mb-6 max-w-xl text-sm">
    Simkl n'a pas de profil public consultable comme Trakt — on récupère ton
    historique (films, séries et anime, watchlist comprise) directement via une
    connexion à ton compte. Rien à exporter ni à uploader.
  </p>

  <a href={`${API_URL}/simkl/connect`} class="btn btn-primary">
    Se connecter à Simkl
  </a>
</div>
