<script lang="ts">
  import { listBookSagas, upsertBookEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import SagasView, {
    type SagaListFilters,
  } from "#lib/components/saga/SagasView.svelte";
  import { m } from "#lib/paraglide/messages.js";
  import { bookSagaMember, librarySagasView } from "#lib/saga.js";
  import type { BookSagaMemberDto } from "@loomkeep/shared";
  import type { Snippet } from "svelte";

  let { modeSwitch }: { modeSwitch: Snippet } = $props();

  // The volumes behind the rows, for "add" to know their source.
  const volumes = new Map<string, BookSagaMemberDto>();

  const toRequest = (f: SagaListFilters) => ({
    query: f.query,
    sort: f.sort,
    order: f.order,
  });

  async function load(f: SagaListFilters) {
    const sagas = await listBookSagas(toRequest(f));
    for (const saga of [...sagas.inProgress, ...sagas.finished])
      for (const volume of saga.members) volumes.set(volume.sourceId, volume);
    return librarySagasView(sagas, bookSagaMember);
  }
</script>

<SagasView
  {modeSwitch}
  icon="book"
  title={m.common_Books()}
  queryKey={(f) => keys.books.sagas(toRequest(f))}
  {load}
  addKey={["books", "sagas"]}
  onAdd={(member) => {
    const volume = volumes.get(member.id)!;
    return upsertBookEntry({
      source: volume.source,
      sourceId: volume.sourceId,
      status: "TO_READ",
    });
  }}
  addButton={m.book_status_to_read()}
  addLabel={(title) => m.book_saga_add_label({ title })}
  finishedHint={m.book_sagas_finished_hint()}
  empty={m.book_sagas_empty()} />
