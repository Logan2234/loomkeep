<script lang="ts">
  import { getAdminUserOptions } from "$lib/api/client";
  import { keys } from "$lib/api/keys";
  import { createApiQuery } from "$lib/api/query.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import Combobox from "./Combobox.svelte";

  let {
    value = null,
    label = m.user_selector_all_accounts(),
    searchPlaceholder = m.user_selector_search_placeholder(),
    onChange,
  }: {
    /** Selected user id, or null for "no account filter". */
    value?: string | null;
    label?: string;
    searchPlaceholder?: string;
    onChange: (userId: string | null) => void;
  } = $props();

  const usersQuery = createApiQuery(() => ({
    key: keys.admin.userOptions(),
    fetch: getAdminUserOptions,
  }));

  const options = $derived([
    { label, value: "" },
    ...(usersQuery.data ?? []).map((u) => ({
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
