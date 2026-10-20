<script lang="ts">
  import Combobox from "../Combobox.svelte";
  import FieldError from "../FieldError.svelte";
  import { MODERATION_LEGAL_BASIS_LABELS } from "#lib/constants/report-labels.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { ModerationLegalBasis } from "@loomkeep/shared";
  let {
    reasonText = $bindable(""),
    legalBasis = $bindable<ModerationLegalBasis>("TOS_BREACH"),
    tosClause = $bindable(""),
    idPrefix,
    reasonPlaceholder,
    clausePlaceholder,
    disabled = false,
    fieldErrors = {},
    inlineErrors = false,
    reasonMargin = "mt-4",
  }: {
    reasonText?: string;
    legalBasis?: ModerationLegalBasis;
    tosClause?: string;
    idPrefix: string;
    reasonPlaceholder: string;
    clausePlaceholder: string;
    disabled?: boolean;
    fieldErrors?: Record<string, string>;
    inlineErrors?: boolean;
    reasonMargin?: string;
  } = $props();
</script>

<label
  class="{reasonMargin} block text-sm font-semibold"
  for="{idPrefix}-reason">{m.admin_moderation_facts()}</label>
<textarea
  id="{idPrefix}-reason"
  name="reasonText"
  bind:value={reasonText}
  {disabled}
  rows="3"
  class="input mt-1 text-sm"
  placeholder={reasonPlaceholder}></textarea>
{#if inlineErrors}<FieldError
    message={fieldErrors.reasonText}
    class="mt-1" />{/if}
<span class="mt-3 block text-sm font-semibold"
  >{m.admin_moderation_basis()}</span>
<Combobox
  label={m.admin_moderation_basis()}
  name="legalBasis"
  options={Object.entries(MODERATION_LEGAL_BASIS_LABELS).map(
    ([value, label]) => ({ value, label }),
  )}
  values={[legalBasis]}
  {disabled}
  onChange={(v) => (legalBasis = v[0] as ModerationLegalBasis)} />
{#if inlineErrors}<FieldError
    message={fieldErrors.legalBasis}
    class="mt-1" />{/if}
{#if legalBasis === "TOS_BREACH"}
  <label class="mt-3 block text-sm font-semibold" for="{idPrefix}-clause"
    >{m.admin_moderation_terms_clause()}</label>
  <input
    id="{idPrefix}-clause"
    type="text"
    name="tosClause"
    bind:value={tosClause}
    {disabled}
    class="input mt-1 text-sm"
    placeholder={clausePlaceholder} />
  {#if inlineErrors}<FieldError
      message={fieldErrors.tosClause}
      class="mt-1" />{/if}
{/if}
