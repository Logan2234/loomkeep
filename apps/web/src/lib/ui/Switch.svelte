<script lang="ts">
  let {
    checked,
    onChange,
    disabled = false,
    label,
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    /** Accessible name, needed when there's no visible adjacent label. */
    label?: string;
  } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class="switch"
  class:switch-on={checked}
  onclick={() => onChange(!checked)}>
  <span class="switch-thumb"></span>
</button>
