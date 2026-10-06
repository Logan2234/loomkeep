<script lang="ts">
  import { getMediaSaga, upsertLibraryEntry } from "#lib/api/client.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiMutation } from "#lib/api/mutation.svelte.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import SagaBlock from "#lib/components/saga/SagaBlock.svelte";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import { m } from "#lib/paraglide/messages.js";
  import { mediaSagaMember } from "#lib/saga.js";
  import type { EntryStatus, MediaType, SagaMemberDto } from "@loomkeep/shared";

  let {
    type,
    sourceId,
    entryStatus,
  }: {
    type: MediaType;
    sourceId: string;
    /** The viewed work's live status, ahead of the saga's own copy. */
    entryStatus: EntryStatus | null;
  } = $props();

  // Keyed on whether the work is tracked: tracking it is what ties it to its
  // saga server-side, so that read has to happen again then.
  const sagaKey = $derived(
    keys.media.saga(type, sourceId, entryStatus !== null),
  );

  const sagaQuery = createApiQuery(() => ({
    key: sagaKey,
    fetch: () => getMediaSaga(type, sourceId).then((r) => r.saga),
    enabled: type !== "SERIES",
    keepPreviousData: true,
  }));

  const members = $derived(
    (sagaQuery.data?.members ?? []).map((member) =>
      member.sourceId === sourceId
        ? { ...member, status: entryStatus }
        : member,
    ),
  );

  const addMut = createApiMutation(() => ({
    mutate: (x: SagaMemberDto) =>
      upsertLibraryEntry({
        source: x.source,
        sourceId: x.sourceId,
        type: x.type,
        status: "PLANNED",
      }),
    invalidates: [sagaKey],
    errorToast: true,
  }));
</script>

<SagaBlock
  title={sagaQuery.data?.title ?? ""}
  members={members.map(mediaSagaMember)}
  currentId={sourceId}
  currentSeen={entryStatus === "COMPLETED"}
  adding={addMut.loading}
  onAdd={(view) => {
    const member = members.find((x) => x.sourceId === view.id);
    if (member) addMut.mutate(member);
  }}
  addButton={m.media_status_planned()}
  addLabel={(title) => m.media_saga_add_label({ title })}
  isNew={isFeatureNew("sagas")} />
