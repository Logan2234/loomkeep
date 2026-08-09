<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(""),
    placeholder,
    required = false,
    minlength,
    autocomplete,
    class: extraClass = "",
  }: {
    value?: string;
    placeholder?: string;
    required?: boolean;
    minlength?: number;
    autocomplete?: "current-password" | "new-password";
    class?: string;
  } = $props();

  let visible = $state(false);
</script>

<div class="relative">
  <input
    type={visible ? "text" : "password"}
    class="input pr-10 {extraClass}"
    {placeholder}
    {required}
    {minlength}
    {autocomplete}
    bind:value />
  <button
    type="button"
    class="text-dim hover:text-fg absolute inset-y-0 right-0 flex w-9 items-center justify-center"
    aria-label={visible ? m.password_hide() : m.password_show()}
    onclick={() => (visible = !visible)}>
    <Icon name={visible ? "eye-off" : "eye"} class="h-4 w-4" />
  </button>
</div>
