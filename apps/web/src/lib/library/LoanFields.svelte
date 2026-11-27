<script lang="ts" module>
  export interface EntryLoan {
    lentOut: boolean;
    loanPerson: string | null;
    loanSince: string | null;
    /** A loan runs: a PHYSICAL copy lent out, a BORROWED one with details. */
    loanActive: boolean;
  }

  export type EntryLoanPatch = Partial<
    Pick<EntryLoan, "lentOut" | "loanPerson" | "loanSince">
  > & { loanReturned?: boolean };
</script>

<script lang="ts">
  import { slide } from "svelte/transition";

  import { getChatFriends } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { appConfig } from "#lib/shell/config.svelte.js";
  import { prefersReducedMotion } from "#lib/ui/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import { toast } from "#lib/ui/toast-store.svelte.js";
  import { LOAN_PERSON_MAX_LENGTH } from "@loomkeep/shared/contracts";
  import Combobox from "../ui/Combobox.svelte";
  import Icon from "../ui/Icon.svelte";

  // Under the ownership menu. A PHYSICAL copy is lent with a button, and
  // comes back with another. A BORROWED entry alone only says the work was
  // borrowed: "Add details" asks who from and since when, and once either is
  // given the borrowing runs until "I gave it back". Private notes — friends
  // are only suggested by name, never told.
  let {
    status,
    loan,
    onChange,
  }: {
    status: string;
    loan: EntryLoan;
    onChange: (patch: EntryLoanPatch) => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const borrowed = $derived(status === "BORROWED");
  const physical = $derived(status === "PHYSICAL");
  // Details asked for on a borrowed entry with no borrowing yet: nothing is
  // saved until a field is filled.
  let addingDetails = $state(false);
  const showFields = $derived(
    (loan.loanActive && (physical || borrowed)) || (borrowed && addingDetails),
  );
  const today = new Date().toISOString().slice(0, 10);

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(""),
    fetch: () => getChatFriends(""),
    enabled: showFields && appConfig.socialEnabled,
  }));
  const friendNames = $derived(
    [...new Set((friendsQuery.data ?? []).map((f) => f.displayName))].sort(),
  );

  // Friends are suggestions, not a closed list: whatever is typed can be kept
  // as is, offered first unless it is a friend's name already.
  const personLabel = $derived(
    borrowed ? m.ownership_borrowed_from() : m.ownership_lent_to(),
  );
  let personQuery = $state("");
  const typedName = $derived(
    personQuery.trim().slice(0, LOAN_PERSON_MAX_LENGTH),
  );
  const personOptions = $derived.by(() => {
    const typed = typedName.toLowerCase();
    const friends = friendNames.filter((name) =>
      name.toLowerCase().includes(typed),
    );
    return [
      ...(typedName && !friends.some((name) => name.toLowerCase() === typed)
        ? [
            {
              value: typedName,
              label: m.ownership_loan_use_name({ name: typedName }),
            },
          ]
        : []),
      ...friends.map((name) => ({ value: name, label: name })),
      ...(loan.loanPerson && !typedName
        ? [{ value: "", label: m.common_none() }]
        : []),
    ];
  });

  function savePerson([value = ""]: string[]) {
    if (value !== (loan.loanPerson ?? ""))
      onChange({ loanPerson: value || null });
  }

  function saveSince(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (value !== (loan.loanSince ?? ""))
      onChange({ loanSince: value || null });
  }

  function giveBack() {
    addingDetails = false;
    onChange({ loanReturned: true });
    toast.action(m.ownership_loan_returned_toast(), {
      label: m.common_undo(),
      onSelect: () => onChange({ loanReturned: false }),
    });
  }
</script>

{#if physical || borrowed}
  <div class="flex flex-col gap-2.5">
    {#if physical && !loan.lentOut}
      <button
        type="button"
        class="btn btn-ghost btn-sm self-start"
        onclick={() => onChange({ lentOut: true })}>
        <Icon name="share" class="h-4 w-4" />
        {m.ownership_lend()}
      </button>
    {:else if borrowed && !showFields}
      <button
        type="button"
        class="btn btn-ghost btn-sm self-start"
        onclick={() => (addingDetails = true)}>
        <Icon name="plus" class="h-4 w-4" />
        {m.ownership_loan_add_details()}
      </button>
    {/if}

    {#if showFields}
      <div
        transition:slide={{ duration: reduced ? 0 : 200 }}
        class="grid gap-2.5 border-l-2 pl-3 sm:grid-cols-2 {borrowed
          ? loan.loanActive
            ? 'border-warning'
            : 'border-border'
          : 'border-accent'}">
        <div class="flex min-w-0 flex-col gap-1">
          <span
            aria-hidden="true"
            class="timecode text-micro tracking-[0.18em] uppercase">
            {personLabel}
          </span>
          <Combobox
            label={personLabel}
            options={personOptions}
            values={loan.loanPerson ? [loan.loanPerson] : []}
            searchable
            searchPlaceholder={m.ownership_loan_person_placeholder()}
            selectedLabel={loan.loanPerson ??
              m.ownership_loan_person_placeholder()}
            onSearch={(query) => (personQuery = query)}
            onChange={savePerson} />
        </div>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="timecode text-micro tracking-[0.18em] uppercase">
            {m.ownership_loan_since()}
          </span>
          <input
            class="input"
            type="date"
            max={today}
            value={loan.loanSince ?? ""}
            onchange={saveSince} />
        </label>
        <p class="text-dim text-xs sm:col-span-2">
          {m.ownership_loan_private()}
        </p>
        {#if loan.loanActive}
          <button
            type="button"
            class="btn btn-ghost btn-sm self-start sm:col-span-2 {borrowed
              ? 'text-warning'
              : 'text-accent'}"
            onclick={giveBack}>
            <Icon name={borrowed ? "reply" : "check"} class="h-4 w-4" />
            {borrowed
              ? m.ownership_borrowed_given_back()
              : m.ownership_lent_returned()}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
