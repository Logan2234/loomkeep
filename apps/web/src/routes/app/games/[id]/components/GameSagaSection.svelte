<script lang="ts">
  import { upsertGameEntry } from "#lib/api/client.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import SagaBlock from "#lib/components/saga/SagaBlock.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";
  import { gameSagaMember } from "#lib/saga.js";
  import type {
    GameSagaDto,
    GameSagaMemberDto,
    GameStatus,
  } from "@loomkeep/shared";

  let {
    saga,
    sagaKey,
    sourceId,
    entryStatus,
  }: {
    saga: GameSagaDto;
    /** The series query's key, refetched once a game is added. */
    sagaKey: readonly unknown[];
    sourceId: string;
    /** The viewed game's live status, ahead of the series' own copy. */
    entryStatus: GameStatus | null;
  } = $props();

  const members = $derived(
    saga.members.map((member) =>
      member.sourceId === sourceId
        ? { ...member, status: entryStatus }
        : member,
    ),
  );

  const addMut = createApiMutation(() => ({
    mutate: (x: GameSagaMemberDto) =>
      upsertGameEntry({
        source: x.source,
        sourceId: x.sourceId,
        status: "BACKLOG",
      }),
    invalidates: [sagaKey],
    errorToast: true,
  }));
</script>

<SagaBlock
  title={saga.title}
  members={members.map(gameSagaMember)}
  currentId={sourceId}
  currentSeen={entryStatus === "COMPLETED"}
  adding={addMut.loading}
  onAdd={(view) => {
    const member = members.find((x) => x.sourceId === view.id);
    if (member) addMut.mutate(member);
  }}
  addButton={m.game_status_backlog()}
  addLabel={(title) => m.game_saga_add_label({ title })}
  isNew={isFeatureNew("game-sagas")} />
