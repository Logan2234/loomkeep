<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  let {
    value = null,
    placeholder = m.notefield_placeholder(),
    onChange,
  }: {
    value?: string | null;
    placeholder?: string;
    onChange: (value: string | null) => void;
  } = $props();
</script>

<div class="flex flex-col gap-1.5">
  <span class="timecode text-[0.62rem] tracking-[0.18em] uppercase"
    >{m.notefield_label()}</span>

  <textarea
    name="notes"
    rows="3"
    maxlength="5000"
    {placeholder}
    class="input bg-surface-2 min-h-16.5 rounded-l-sm text-sm"
    value={value ?? ""}
    onchange={(e) => {
      const raw = e.currentTarget.value.trim();
      onChange(raw === "" ? null : raw);
    }}></textarea>
</div>
