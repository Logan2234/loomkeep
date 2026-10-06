<script lang="ts">
  import { listGameSagas, upsertGameEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import SagasView, {
    type SagaListFilters,
  } from "#lib/components/saga/SagasView.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { gameSagaMember, librarySagasView } from "#lib/saga.js";
  import type { GameSagaMemberDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";

  let { modeSwitch }: { modeSwitch: Snippet } = $props();

  // The games behind the rows, for "add" to know their source.
  const games = new Map<string, GameSagaMemberDto>();

  const toRequest = (f: SagaListFilters) => ({
    query: f.query,
    sort: f.sort,
    order: f.order,
  });

  async function load(f: SagaListFilters) {
    const sagas = await listGameSagas(toRequest(f));
    for (const saga of [
      ...sagas.inProgress,
      ...sagas.waiting,
      ...sagas.finished,
    ])
      for (const game of saga.members) games.set(game.sourceId, game);
    return librarySagasView(sagas, gameSagaMember);
  }
</script>

<SagasView
  {modeSwitch}
  icon="gamepad"
  title={m.common_Games()}
  queryKey={(f) => keys.games.sagas(toRequest(f))}
  {load}
  addKey={["games", "sagas"]}
  onAdd={(member) => {
    const game = games.get(member.id)!;
    return upsertGameEntry({
      source: game.source,
      sourceId: game.sourceId,
      status: "BACKLOG",
    });
  }}
  addButton={m.game_status_backlog()}
  addLabel={(title) => m.game_saga_add_label({ title })}
  finishedHint={m.game_sagas_finished_hint()}
  empty={m.game_sagas_empty()} />
