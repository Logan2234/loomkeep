<script lang="ts">
  import { listLibrarySagas, upsertLibraryEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import SagasView, {
    type SagaListFilters,
  } from "#lib/components/saga/SagasView.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { librarySagasView, mediaSagaMember } from "#lib/saga.js";
  import type { MediaType, SagaMemberDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";

  let { modeSwitch }: { modeSwitch: Snippet } = $props();

  const TYPE_OPTIONS: { label: string; value: MediaType }[] = [
    { label: m.media_movies(), value: "MOVIE" },
    { label: m.media_anime(), value: "ANIME" },
  ];

  // The works behind the rows, for "add" to know their source and type.
  const works = new Map<string, SagaMemberDto>();

  const toRequest = (f: SagaListFilters) => ({
    query: f.query,
    types: f.types as MediaType[],
    sort: f.sort,
    order: f.order,
  });

  async function load(f: SagaListFilters) {
    const sagas = await listLibrarySagas(toRequest(f));
    for (const saga of [
      ...sagas.inProgress,
      ...sagas.waiting,
      ...sagas.finished,
    ])
      for (const work of saga.members) works.set(work.sourceId, work);
    return librarySagasView(sagas, mediaSagaMember, (saga) =>
      saga.members[0]?.type === "ANIME" ? m.media_anime() : m.media_movies(),
    );
  }
</script>

<SagasView
  {modeSwitch}
  icon="tv"
  title={m.common_Media()}
  typeOptions={TYPE_OPTIONS}
  queryKey={(f) => keys.library.sagas(toRequest(f))}
  {load}
  addKey={["library", "sagas"]}
  onAdd={(member) => {
    const work = works.get(member.id)!;
    return upsertLibraryEntry({
      source: work.source,
      sourceId: work.sourceId,
      type: work.type,
      status: "PLANNED",
    });
  }}
  addButton={m.media_status_planned()}
  addLabel={(title) => m.media_saga_add_label({ title })}
  finishedHint={m.media_sagas_finished_hint()}
  empty={m.media_sagas_empty()} />
