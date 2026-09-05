<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";
  import Icon from "./Icon.svelte";

  let {
    value = $bindable(""),
    placeholder,
    name,
    ariaLabel,
    required = false,
    minlength,
    maxlength,
    autocomplete,
    enterkeyhint,
    class: extraClass = "",
  }: {
    value?: string;
    placeholder?: string;
    name?: string;
    ariaLabel?: string;
    required?: boolean;
    minlength?: number;
    maxlength?: number;
    autocomplete?: "current-password" | "new-password";
    enterkeyhint?:
      "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
    class?: string;
  } = $props();

  let visible = $state(false);
</script>

<div class="relative">
  <input
    type={visible ? "text" : "password"}
    class="input pr-10 {extraClass}"
    {name}
    aria-label={ariaLabel}
    {placeholder}
    {required}
    {minlength}
    {maxlength}
    {autocomplete}
    {enterkeyhint}
    bind:value />
  <button
    type="button"
    class="text-dim hover:text-fg absolute inset-y-0 right-0 flex w-9 items-center justify-center transition-colors"
    aria-label={visible ? m.common_password_hide() : m.common_password_show()}
    onclick={() => (visible = !visible)}>
    <Icon name={visible ? "eye-off" : "eye"} class="h-4 w-4" />
  </button>
</div>
