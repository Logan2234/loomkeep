<script lang="ts">
  import {
    REPORT_CATEGORY_HINTS,
    REPORT_CATEGORY_LABELS,
    REPORT_CATEGORY_ORDER,
    REPORT_MOTIF_LABELS,
    REPORT_PROFILE_PARTS,
    REPORT_TARGET_LABELS,
  } from "#lib/constants/report-labels.js";
  import { prefersReducedMotion } from "#lib/motion.js";
  import { m } from "#lib/paraglide/messages.js";
  import {
    REPORT_MOTIFS_REQUIRING_REASON,
    REPORT_PROFILE_PART_CATEGORIES,
    isReportCategoryAllowed,
    reportMotifsFor,
    type ReportCategory,
    type ReportMotif,
    type ReportProfilePart,
    type ReportTargetType,
    REPORT_REASON_MAX_LENGTH,
  } from "@loomkeep/shared";
  import { flip } from "svelte/animate";
  import { fade, slide } from "svelte/transition";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  // (Profile part →) category → motif → detail picker, shared by every
  // reportable content type. The caller files the report and owns the
  // success/failure toast.
  let {
    title,
    targetType,
    subject,
    onClose,
    onSubmit,
  }: {
    title: string;
    /** Narrows the categories to those that apply to this content. */
    targetType: ReportTargetType;
    /** What is being reported, recalled at the top of the modal. */
    subject?: { title: string; detail?: string | null };
    onClose: () => void;
    onSubmit: (report: {
      category: ReportCategory;
      motif?: ReportMotif;
      reason?: string;
      /** Set for a profile (USER) report only. */
      profilePart?: ReportProfilePart;
    }) => void;
  } = $props();

  const reduced = prefersReducedMotion();
  const isProfile = $derived(targetType === "USER");

  let profilePart = $state<ReportProfilePart | null>(null);
  let category = $state<ReportCategory | null>(null);
  let motif = $state<ReportMotif | null>(null);
  let reason = $state("");

  const categories = $derived(
    isProfile && !profilePart
      ? []
      : REPORT_CATEGORY_ORDER.filter(
          (c) =>
            isReportCategoryAllowed(c, targetType) &&
            (!profilePart ||
              REPORT_PROFILE_PART_CATEGORIES[profilePart].includes(c)),
        ),
  );
  const partHint = $derived(
    REPORT_PROFILE_PARTS.find((part) => part.value === profilePart)?.hint,
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
  const showReason = $derived(
    category !== null && (category === "OTHER" || motif !== null),
  );
  const canSubmit = $derived(
    showReason && (!reasonRequired || reason.trim().length > 0),
  );

  function choosePart(next: ReportProfilePart) {
    profilePart = next;
    if (category && !REPORT_PROFILE_PART_CATEGORIES[next].includes(category)) {
      category = null;
      motif = null;
    }
  }

  function toggleCategory(next: ReportCategory) {
    if (category === next) {
      category = null;
      motif = null;
      return;
    }
    category = next;
    // A category with a single motif needs no choice: it's pre-picked and
    // the row opens straight onto the detail field.
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
  <div class="flex flex-col gap-4">
    {#if subject}
      <div class="bg-surface-2 rounded-xl px-3.5 py-3">
        <p class="timecode text-micro tracking-wide uppercase">
          {REPORT_TARGET_LABELS[targetType]}
        </p>
        <p class="mt-0.5 truncate font-semibold">{subject.title}</p>
        {#if subject.detail}
          <p class="text-dim mt-0.5 line-clamp-2 text-xs">{subject.detail}</p>
        {/if}
      </div>
    {/if}

    {#if isProfile}
      <div>
        <p class="mb-2 text-sm font-semibold">{m.report_part_question()}</p>
        <SegmentedControl
          class="w-full [&>*]:flex-1 [&>*]:justify-center"
          label={m.report_part_question()}
          options={REPORT_PROFILE_PARTS}
          value={profilePart ?? ("" as ReportProfilePart)}
          onChange={choosePart} />
        {#if partHint}
          {#key partHint}
            <p
              class="text-dim mt-1.5 text-xs"
              in:fade={{ duration: reduced ? 0 : 160 }}>
              {partHint}
            </p>
          {/key}
        {/if}
      </div>
    {/if}

    {#if categories.length > 0}
      <ul
        class="border-border divide-border/60 divide-y overflow-hidden rounded-xl border"
        in:fade={{ duration: reduced ? 0 : 180 }}>
        {#each categories as option (option)}
          {@const open = category === option}
          {@const motifs = reportMotifsFor(option, targetType)}
          <li animate:flip={{ duration: reduced ? 0 : 220 }}>
            <button
              type="button"
              aria-expanded={open}
              class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors {open
                ? 'bg-accent/6'
                : 'hover:bg-surface-2'}"
              onclick={() => toggleCategory(option)}>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold">
                  {REPORT_CATEGORY_LABELS[option]}
                </span>
                <span class="text-dim block text-xs">
                  {REPORT_CATEGORY_HINTS[option]}
                </span>
              </span>
              <Icon
                name="chevron-right"
                class="h-4 w-4 shrink-0 transition-transform {open
                  ? 'text-accent rotate-90'
                  : 'text-dim'}" />
            </button>
            {#if open && motifs.length > 1}
              <div
                role="radiogroup"
                aria-label={REPORT_CATEGORY_LABELS[option]}
                class="bg-accent/6 flex flex-col px-3.5 pb-2"
                transition:slide={{ duration: reduced ? 0 : 200 }}>
                {#each motifs as choice (choice)}
                  <label
                    class="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                    <input
                      type="radio"
                      name="report-motif"
                      value={choice}
                      class="accent-accent h-4 w-4 shrink-0"
                      checked={motif === choice}
                      onchange={() => (motif = choice)} />
                    {REPORT_MOTIF_LABELS[choice]}
                  </label>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if showReason}
      <div transition:slide={{ duration: reduced ? 0 : 200 }}>
        <textarea
          name="reason"
          aria-label={reasonPlaceholder}
          aria-required={reasonRequired}
          class="input min-h-20 resize-y text-sm"
          rows="3"
          placeholder={reasonPlaceholder}
          maxlength={REPORT_REASON_MAX_LENGTH}
          bind:value={reason}></textarea>
      </div>
    {/if}
  </div>

  {#snippet actions()}
    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" onclick={onClose}>
        {m.common_cancel()}
      </button>
      <button class="btn btn-primary" disabled={!canSubmit} onclick={submit}>
        <Icon name="flag" class="h-4 w-4" />
        {m.common_report()}
      </button>
    </div>
  {/snippet}
</Modal>
