<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { onMount } from "svelte";

  // One box per digit. Typing moves to the next box and erasing to the
  // previous one; a pasted or autofilled code spreads over all of them.
  let {
    length,
    label,
    oninput,
    oncomplete,
  }: {
    length: number;
    label: string;
    oninput: (code: string) => void;
    oncomplete: (code: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let digits = $state<string[]>(Array.from({ length }, () => ""));
  const boxes: HTMLInputElement[] = [];

  onMount(() => boxes[0]?.focus());

  function focusBox(index: number) {
    boxes[Math.max(0, Math.min(index, length - 1))]?.focus();
  }

  function emit() {
    const code = digits.join("");
    oninput(code);
    if (code.length === length) oncomplete(code);
  }

  function spread(from: number, typed: string) {
    const start = typed.length >= length ? 0 : from;
    for (let k = 0; k < typed.length && start + k < length; k++) {
      digits[start + k] = typed[k];
    }
    focusBox(start + typed.length);
    emit();
  }

  function onInput(index: number, event: Event) {
    const box = event.currentTarget as HTMLInputElement;
    const { inputType, data } = event as InputEvent;
    const typed = (
      inputType === "insertText" && data ? data : box.value
    ).replace(/\D/g, "");
    if (typed.length > 1) {
      box.value = digits[index];
      spread(index, typed);
      return;
    }
    digits[index] = typed;
    box.value = typed;
    if (typed) focusBox(index + 1);
    else if (inputType === "deleteContentBackward") focusBox(index - 1);
    emit();
  }

  function onKeydown(index: number, event: KeyboardEvent) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) digits[index] = "";
      else if (index > 0) digits[index - 1] = "";
      focusBox(index - 1);
      emit();
    } else if (event.key === "Delete") {
      event.preventDefault();
      digits[index] = "";
      emit();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function onPaste(index: number, event: ClipboardEvent) {
    event.preventDefault();
    const typed = (event.clipboardData?.getData("text") ?? "").replace(
      /\D/g,
      "",
    );
    if (typed) spread(index, typed);
  }
</script>

<div role="group" aria-label={label} class="flex gap-2">
  {#each digits as digit, index (index)}
    <input
      bind:this={boxes[index]}
      type="text"
      inputmode="numeric"
      autocomplete={index === 0 ? "one-time-code" : "off"}
      aria-label={m.auth_mfa_code_digit({
        position: index + 1,
        total: length,
      })}
      value={digit}
      class="input h-18! min-w-0 flex-1 rounded-xl px-0 text-center font-mono text-2xl!"
      onfocus={(e) => e.currentTarget.select()}
      onclick={(e) => e.currentTarget.select()}
      oninput={(e) => onInput(index, e)}
      onkeydown={(e) => onKeydown(index, e)}
      onpaste={(e) => onPaste(index, e)} />
  {/each}
</div>
