<script lang="ts">
  // Searchable account picker, built on Combobox — the same pattern
  // /admin/communications uses inline, extracted so any admin surface can
  // filter by account. Loads the
  // account list itself and emits the selected user id (null once cleared).
  import { getAdminUserOptions } from "$lib/api/client";
  import type { AdminUserOptionDto } from "@loomkeep/shared";
  import Combobox from "./Combobox.svelte";

  let {
    value = null,
    label = "Tous les comptes",
    searchPlaceholder = "Rechercher par nom ou email…",
    onChange,
  }: {
    /** Selected user id, or null for "no account filter". */
    value?: string | null;
    label?: string;
    searchPlaceholder?: string;
    onChange: (userId: string | null) => void;
  } = $props();

  let users = $state<AdminUserOptionDto[]>([]);

  $effect(() => {
    getAdminUserOptions()
      .then((u) => (users = u))
      .catch(() => {});
  });

  const options = $derived([
    { label, value: "" },
    ...users.map((u) => ({
      label: `${u.displayName} <${u.email}>`,
      value: u.id,
    })),
  ]);
</script>

<Combobox
  {label}
  {options}
  values={value ? [value] : []}
  searchable
  {searchPlaceholder}
  onChange={(v) => onChange(v[0] || null)} />
