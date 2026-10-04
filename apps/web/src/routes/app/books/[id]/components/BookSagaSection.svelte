<script lang="ts">
  import { upsertBookEntry } from "$lib/api/client";
  import { createApiMutation } from "$lib/api/mutation.svelte";
  import SagaBlock from "$lib/components/saga/SagaBlock.svelte";
  import { isFeatureNew } from "$lib/feature-badges";
  import { m } from "$lib/paraglide/messages.js";
  import { bookSagaMember } from "$lib/saga";
  import type {
    BookSagaDto,
    BookSagaMemberDto,
    BookStatus,
  } from "@loomkeep/shared";

  let {
    saga,
    sagaKey,
    sourceId,
    entryStatus,
  }: {
    saga: BookSagaDto;
    /** The series query's key, refetched once a volume is added. */
    sagaKey: readonly unknown[];
    sourceId: string;
    /** The viewed book's live status, ahead of the series' own copy. */
    entryStatus: BookStatus | null;
  } = $props();

  const members = $derived(
    saga.members.map((member) =>
      member.sourceId === sourceId
        ? { ...member, status: entryStatus }
        : member,
    ),
  );

  const addMut = createApiMutation(() => ({
    mutate: (x: BookSagaMemberDto) =>
      upsertBookEntry({
        source: x.source,
        sourceId: x.sourceId,
        status: "TO_READ",
      }),
    invalidates: [sagaKey],
    errorToast: true,
  }));
</script>

<SagaBlock
  title={saga.title}
  members={members.map(bookSagaMember)}
  currentId={sourceId}
  currentSeen={entryStatus === "READ"}
  adding={addMut.loading}
  onAdd={(view) => {
    const member = members.find((x) => x.sourceId === view.id);
    if (member) addMut.mutate(member);
  }}
  addButton={m.book_status_to_read()}
  addLabel={(title) => m.book_saga_add_label({ title })}
  isNew={isFeatureNew("book-sagas")} />
