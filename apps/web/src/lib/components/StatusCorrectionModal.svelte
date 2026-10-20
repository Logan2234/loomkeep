<script lang="ts" generics="T extends string">
  import Modal from "./Modal.svelte";
  import SegmentedStatusControl from "./SegmentedStatusControl.svelte";
  import { m } from "#lib/paraglide/messages.js";
  let {
    statuses,
    current,
    disabled,
    meta,
    desc,
    activeClass,
    onSelect,
    onclose,
  }: {
    statuses: T[];
    current: T;
    disabled: boolean;
    meta: Record<T, { label: string }>;
    desc: Record<T, string>;
    activeClass: Record<T, string>;
    onSelect: (status: T) => void;
    onclose: () => void;
  } = $props();
</script>

<Modal title={m.tracking_correct_status()} {onclose}>
  <p class="text-dim mb-4 text-sm">{m.tracking_correct_status_help()}</p>
  <SegmentedStatusControl
    {statuses}
    {current}
    {disabled}
    {meta}
    {desc}
    {activeClass}
    {onSelect} />
</Modal>
