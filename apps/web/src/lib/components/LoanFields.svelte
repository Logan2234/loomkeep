<script lang="ts" module>
  export interface EntryLoan {
    lentOut: boolean;
    loanPerson: string | null;
    loanSince: string | null;
  }
</script>

<script lang="ts">
  import { getChatFriends } from "#lib/api/chat.js";
  import { keys } from "#lib/api/keys.js";
  import { createApiQuery } from "#lib/api/query.svelte.js";
  import { appConfig } from "#lib/config.svelte.js";
  import { m } from "#lib/paraglide/messages.js";
  import { LOAN_PERSON_MAX_LENGTH } from "@loomkeep/shared";

  // Under the ownership menu: who a BORROWED work came from, or who has a
  // PHYSICAL copy lent out, and since when. Private notes — friends are only
  // suggested by name, never told.
  let {
    status,
    loan,
    onChange,
  }: {
    status: string;
    loan: EntryLoan;
    onChange: (patch: Partial<EntryLoan>) => void;
  } = $props();

  const borrowed = $derived(status === "BORROWED");
  const open = $derived(borrowed || (status === "PHYSICAL" && loan.lentOut));
  const today = new Date().toISOString().slice(0, 10);
  const uid = $props.id();

  const friendsQuery = createApiQuery(() => ({
    key: keys.chat.friends(""),
    fetch: () => getChatFriends(""),
    enabled: open && appConfig.socialEnabled,
  }));
  const friendNames = $derived(
    [...new Set((friendsQuery.data ?? []).map((f) => f.displayName))].sort(),
  );

  function savePerson(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value.trim();
    if (value !== (loan.loanPerson ?? ""))
      onChange({ loanPerson: value || null });
  }

  function saveSince(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (value !== (loan.loanSince ?? ""))
      onChange({ loanSince: value || null });
  }
</script>

{#if status === "PHYSICAL" || borrowed}
  <div class="flex flex-col gap-2.5">
    {#if !borrowed}
      <label class="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={loan.lentOut}
          onchange={(e) => onChange({ lentOut: e.currentTarget.checked })} />
        {m.ownership_lent_out()}
      </label>
    {/if}

    {#if open}
      <div
        class="grid gap-2.5 border-l-2 pl-3 sm:grid-cols-2 {borrowed
          ? 'border-warning'
          : 'border-accent'}">
        <label class="flex min-w-0 flex-col gap-1">
          <span class="timecode text-micro tracking-[0.18em] uppercase">
            {borrowed ? m.ownership_borrowed_from() : m.ownership_lent_to()}
          </span>
          <input
            class="input"
            type="text"
            list={friendNames.length > 0 ? `${uid}-friends` : undefined}
            maxlength={LOAN_PERSON_MAX_LENGTH}
            placeholder={m.ownership_loan_person_placeholder()}
            value={loan.loanPerson ?? ""}
            onchange={savePerson} />
        </label>
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
        {#if friendNames.length > 0}
          <datalist id="{uid}-friends">
            {#each friendNames as name (name)}
              <option value={name}></option>
            {/each}
          </datalist>
        {/if}
        <p class="text-dim text-xs sm:col-span-2">
          {m.ownership_loan_private()}
        </p>
      </div>
    {/if}
  </div>
{/if}
