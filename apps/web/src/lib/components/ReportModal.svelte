<script lang="ts">
  import {
    REPORT_CATEGORY_HINTS,
    REPORT_CATEGORY_LABELS,
    REPORT_CATEGORY_ORDER,
    REPORT_MOTIF_LABELS,
  } from "$lib/constants/report-labels";
  import { m } from "$lib/paraglide/messages.js";
  import {
    REPORT_CATEGORY_MOTIFS,
    isReportCategoryAllowed,
    type ReportCategory,
    type ReportMotif,
    type ReportTargetType,
  } from "@loomkeep/shared";
  import Combobox from "./Combobox.svelte";
  import Modal from "./Modal.svelte";

  // Category → motif → optional detail picker, shared by every reportable
  // content type (comments, reviews). The caller files the report and owns
  // the success/failure toast.
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
    }) => void;
  } = $props();

  let category = $state<ReportCategory | null>(null);
  let motif = $state<ReportMotif | null>(null);
  let reason = $state("");

  const categoryOptions = $derived(
    REPORT_CATEGORY_ORDER.filter((c) =>
      isReportCategoryAllowed(c, targetType),
    ).map((c) => ({ label: REPORT_CATEGORY_LABELS[c], value: c })),
  );
  const motifOptions = $derived(
    category ? REPORT_CATEGORY_MOTIFS[category] : [],
  );
  const isOther = $derived(category === "OTHER");
  const canSubmit = $derived(
    category !== null && (isOther ? reason.trim().length > 0 : motif !== null),
  );

  function chooseCategory(next: ReportCategory) {
    category = next;
    // Skip the motif step entirely when the category only has one — nothing
    // to choose between, so pre-check it instead of showing a 1-item list.
    const motifs = REPORT_CATEGORY_MOTIFS[next];
    motif = motifs.length === 1 ? motifs[0] : null;
  }

  function submit() {
    if (!category || !canSubmit) return;
    onSubmit({
      category,
      motif: motif ?? undefined,
      reason: reason.trim() || undefined,
    });
  }
</script>

<Modal {title} onclose={onClose}>
  <div class="flex flex-col gap-3">
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
        aria-label={isOther
          ? m.report_reason_placeholder()
          : m.report_detail_placeholder()}
        class="input min-h-20 resize-y text-sm"
        rows="3"
        placeholder={isOther
          ? m.report_reason_placeholder()
          : m.report_detail_placeholder()}
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
