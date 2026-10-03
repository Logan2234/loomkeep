<script lang="ts">
  import {
    REPORT_CATEGORY_HINTS,
    REPORT_CATEGORY_LABELS,
    REPORT_CATEGORY_ORDER,
    REPORT_MOTIF_LABELS,
    REPORT_PROFILE_PARTS,
  } from "$lib/constants/report-labels";
  import { m } from "$lib/paraglide/messages.js";
  import {
    REPORT_MOTIFS_REQUIRING_REASON,
    REPORT_PROFILE_PART_CATEGORIES,
    isReportCategoryAllowed,
    reportMotifsFor,
    type ReportCategory,
    type ReportMotif,
    type ReportProfilePart,
    type ReportTargetType,
  } from "@loomkeep/shared";
  import Combobox from "./Combobox.svelte";
  import Modal from "./Modal.svelte";

  // (Profile part →) category → motif → detail picker, shared by every
  // reportable content type. The caller files the report and owns the
  // success/failure toast.
  let {
    title,
    targetType,
    onClose,
    onSubmit,
  }: {
    title: string;
    /** Narrows the categories to those that apply to this content. */
    targetType: ReportTargetType;
    onClose: () => void;
    onSubmit: (report: {
      category: ReportCategory;
      motif?: ReportMotif;
      reason?: string;
      /** Set for a profile (USER) report only. */
      profilePart?: ReportProfilePart;
    }) => void;
  } = $props();

  const isProfile = $derived(targetType === "USER");

  let profilePart = $state<ReportProfilePart | null>(null);
  let category = $state<ReportCategory | null>(null);
  let motif = $state<ReportMotif | null>(null);
  let reason = $state("");

  const categoryOptions = $derived(
    isProfile && !profilePart
      ? []
      : REPORT_CATEGORY_ORDER.filter(
          (c) =>
            isReportCategoryAllowed(c, targetType) &&
            (!profilePart ||
              REPORT_PROFILE_PART_CATEGORIES[profilePart].includes(c)),
        ).map((c) => ({ label: REPORT_CATEGORY_LABELS[c], value: c })),
  );
  const motifOptions = $derived(
    category ? reportMotifsFor(category, targetType) : [],
  );
  const reasonRequired = $derived(
    category === "OTHER" ||
      (motif !== null && REPORT_MOTIFS_REQUIRING_REASON.includes(motif)),
  );
  const reasonPlaceholder = $derived(
    category === "OTHER"
      ? m.report_reason_placeholder()
      : reasonRequired
        ? m.report_law_placeholder()
        : m.report_detail_placeholder(),
  );
  const canSubmit = $derived(
    category !== null &&
      (category === "OTHER" || motif !== null) &&
      (!reasonRequired || reason.trim().length > 0),
  );

  function choosePart(next: ReportProfilePart) {
    profilePart = next;
    if (category && !REPORT_PROFILE_PART_CATEGORIES[next].includes(category)) {
      category = null;
      motif = null;
    }
  }

  function chooseCategory(next: ReportCategory) {
    category = next;
    // Skip the motif step entirely when the category only has one — nothing
    // to choose between, so pre-check it instead of showing a 1-item list.
    const motifs = reportMotifsFor(next, targetType);
    motif = motifs.length === 1 ? motifs[0] : null;
  }

  function submit() {
    if (!category || !canSubmit) return;
    onSubmit({
      category,
      motif: motif ?? undefined,
      reason: reason.trim() || undefined,
      profilePart: profilePart ?? undefined,
    });
  }
</script>

<Modal {title} onclose={onClose}>
  <div class="flex flex-col gap-3">
    {#if isProfile}
      <fieldset>
        <legend class="mb-2 text-sm font-semibold">
          {m.report_part_question()}
        </legend>
        <div class="grid grid-cols-2 gap-2">
          {#each REPORT_PROFILE_PARTS as part (part.value)}
            <button
              type="button"
              class="border-border hover:border-accent rounded-lg border p-2.5 text-left transition-colors {profilePart ===
              part.value
                ? 'border-accent ring-accent ring-1'
                : ''}"
              aria-pressed={profilePart === part.value}
              onclick={() => choosePart(part.value)}>
              <span class="block text-sm font-semibold">{part.label}</span>
              <span class="text-dim block text-xs">{part.hint}</span>
            </button>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if categoryOptions.length > 0}
      <div>
        <Combobox
          label={m.common_category()}
          options={categoryOptions}
          values={category ? [category] : []}
          onChange={(v) => chooseCategory(v[0] as ReportCategory)} />
        {#if category}
          <p class="text-dim mt-1.5 text-xs">
            {REPORT_CATEGORY_HINTS[category]}
          </p>
        {/if}
      </div>
    {/if}

    {#if motifOptions.length > 1}
      <ul class="divide-border flex flex-col divide-y">
        {#each motifOptions as option (option)}
          <li>
            <label
              class="flex cursor-pointer items-center gap-2.5 py-2 text-sm">
              <input
                type="radio"
                name="report-motif"
                value={option}
                class="accent-accent h-4 w-4 shrink-0"
                checked={motif === option}
                onchange={() => (motif = option)} />
              {REPORT_MOTIF_LABELS[option]}
            </label>
          </li>
        {/each}
      </ul>
    {/if}

    {#if category}
      <textarea
        name="reason"
        aria-label={reasonPlaceholder}
        aria-required={reasonRequired}
        class="input min-h-20 resize-y text-sm"
        rows="3"
        placeholder={reasonPlaceholder}
        maxlength={500}
        bind:value={reason}></textarea>
    {/if}
  </div>

  <div class="mt-3 flex justify-end gap-2">
    <button class="btn btn-ghost" onclick={onClose}>
      {m.common_cancel()}
    </button>
    <button class="btn btn-primary" disabled={!canSubmit} onclick={submit}>
      {m.common_report()}
    </button>
  </div>
</Modal>
