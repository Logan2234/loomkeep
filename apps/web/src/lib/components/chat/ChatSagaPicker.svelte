<script lang="ts">
  import { listBookSagas } from "#lib/api/books.js";
  import { listGameSagas } from "#lib/api/games.js";
  import { keys } from "#lib/api/keys.js";
  import { listLibrarySagas } from "#lib/api/library.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { auth } from "#lib/auth.svelte.js";
  import { sagaChoices, type SagaChoice } from "#lib/chat/commands.js";
  import Poster from "#lib/components/Poster.svelte";
  import { DOMAINS } from "#lib/constants/domains.js";
  import { isDomainEnabled, orderedDomains } from "#lib/domain-availability.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { SagaDomain } from "@loomkeep/shared";
  import ChatPicker from "./ChatPicker.svelte";

  let {
    query,
    onpick,
    oncancel,
  }: {
    /** What follows `/saga `. */
    query: string;
    onpick: (saga: SagaChoice) => void;
    oncancel: () => void;
  } = $props();

  const SAGA_DOMAINS: SagaDomain[] = ["MEDIA", "GAMES", "BOOKS"];
  const domains = $derived(
    orderedDomains(auth.user?.domainOrder).filter(
      (d): d is SagaDomain =>
        SAGA_DOMAINS.includes(d as SagaDomain) && isDomainEnabled(d),
    ),
  );

  const mediaQuery = createApiQuery(() => ({
    key: keys.library.sagas({}),
    fetch: () => listLibrarySagas(),
    enabled: domains.includes("MEDIA"),
  }));
  const gamesQuery = createApiQuery(() => ({
    key: keys.games.sagas({}),
    fetch: () => listGameSagas(),
    enabled: domains.includes("GAMES"),
  }));
  const booksQuery = createApiQuery(() => ({
    key: keys.books.sagas({}),
    fetch: () => listBookSagas(),
    enabled: domains.includes("BOOKS"),
  }));
  const loading = $derived(
    mediaQuery.loading || gamesQuery.loading || booksQuery.loading,
  );
  const sagas = $derived(
    sagaChoices(
      domains.map((domain) => ({
        domain,
        list:
          (domain === "MEDIA"
            ? mediaQuery.data
            : domain === "GAMES"
              ? gamesQuery.data
              : booksQuery.data) ?? undefined,
      })),
      query,
    ),
  );

  let picker = $state<{ handleKey: (event: KeyboardEvent) => boolean } | null>(
    null,
  );

  export function handleKey(event: KeyboardEvent): boolean {
    return picker?.handleKey(event) ?? false;
  }
</script>

<ChatPicker
  bind:this={picker}
  items={sagas}
  key={(saga) => `${saga.domain}:${saga.key}`}
  label={m.chat_saga_picker()}
  title={m.chat_saga_picker()}
  empty={loading ? m.common_loading() : m.chat_saga_empty()}
  {onpick}
  {oncancel}>
  {#snippet row(saga)}
    <span class="w-[26px] shrink-0 overflow-hidden rounded">
      <Poster src={saga.imageUrl} title={saga.title} alt="" caption={false} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold">{saga.title}</span>
      <span class="text-dim block truncate text-xs">
        {DOMAINS[saga.domain].label}
      </span>
    </span>
    <span class="text-accent shrink-0 font-mono text-sm font-bold">
      {saga.seen}/{saga.released}
    </span>
  {/snippet}
</ChatPicker>
