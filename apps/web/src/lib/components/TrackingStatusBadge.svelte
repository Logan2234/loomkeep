<script lang="ts">
  import {
    BOOK_STATUS_DESC,
    BOOK_STATUS_META,
    GAME_STATUS_DESC,
    GAME_STATUS_META,
  } from "$lib/constants/status-labels";
  import type { IconName } from "$lib/types/icon-name";
  import type { BookStatus, GameStatus } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";

  let {
    domain,
    status,
    class: cls = "",
  }: {
    domain: "BOOKS" | "GAMES";
    status: BookStatus | GameStatus;
    class?: string;
  } = $props();

  const label = $derived(
    domain === "BOOKS"
      ? BOOK_STATUS_META[status as BookStatus].label
      : GAME_STATUS_META[status as GameStatus].label,
  );
  const description = $derived(
    domain === "BOOKS"
      ? BOOK_STATUS_DESC[status as BookStatus]
      : GAME_STATUS_DESC[status as GameStatus],
  );
  const active = $derived(status === "READING" || status === "PLAYING");
  const completed = $derived(status === "READ" || status === "COMPLETED");
  const dropped = $derived(status === "DROPPED");
  const icon = $derived<IconName>(
    completed
      ? "check"
      : dropped
        ? "x"
        : active
          ? domain === "BOOKS"
            ? "book-open"
            : "play"
          : domain === "BOOKS"
            ? "book"
            : "gamepad",
  );
</script>

<span
  title={description}
  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold {active
    ? 'bg-accent/12 text-accent'
    : completed
      ? 'bg-success/12 text-success'
      : dropped
        ? 'bg-danger/10 text-danger'
        : 'bg-surface-2 text-dim'} {cls}">
  <span data-status-icon={icon}>
    <Icon name={icon} class="h-3.5 w-3.5" />
  </span>
  {label}
</span>
