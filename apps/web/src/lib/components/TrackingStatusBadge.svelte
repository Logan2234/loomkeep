<script lang="ts">
  import {
    BOOK_STATUS_DESC,
    BOOK_STATUS_META,
    GAME_STATUS_DESC,
    GAME_STATUS_META,
    MEDIA_STATUS_DESC,
    MEDIA_STATUS_META,
    MUSIC_STATUS_DESC,
    MUSIC_STATUS_META,
  } from "#lib/constants/status-labels.js";
  import {
    STATUS_LOOKS,
    type StatusTone,
  } from "#lib/constants/status-looks.js";
  import type {
    BookStatus,
    EntryStatus,
    GameStatus,
    MusicStatus,
  } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";

  let {
    domain,
    status,
    onImage = false,
    class: cls = "",
  }: (
    | { domain: "MEDIA"; status: EntryStatus }
    | { domain: "BOOKS"; status: BookStatus }
    | { domain: "GAMES"; status: GameStatus }
    | { domain: "MUSIC"; status: MusicStatus }
  ) & {
    /** Over a backdrop image, where the tinted fills wouldn't read. */
    onImage?: boolean;
    class?: string;
  } = $props();

  const TEXTS: Record<
    typeof domain,
    { meta: Record<string, { label: string }>; desc: Record<string, string> }
  > = {
    MEDIA: { meta: MEDIA_STATUS_META, desc: MEDIA_STATUS_DESC },
    BOOKS: { meta: BOOK_STATUS_META, desc: BOOK_STATUS_DESC },
    GAMES: { meta: GAME_STATUS_META, desc: GAME_STATUS_DESC },
    MUSIC: { meta: MUSIC_STATUS_META, desc: MUSIC_STATUS_DESC },
  };

  const TONES: Record<StatusTone, string> = {
    idle: "bg-surface-2 text-dim",
    active: "bg-accent/12 text-accent",
    done: "bg-success/12 text-success",
    dropped: "bg-danger/10 text-danger",
  };

  // Solid fills: the theme's tinted ones vanish on a dark backdrop in light mode.
  const TONES_ON_IMAGE: Record<StatusTone, string> = {
    idle: "bg-white/15 text-white backdrop-blur",
    active: "bg-accent text-accent-fg",
    done: "bg-success text-bg",
    dropped: "bg-danger text-bg",
  };

  const look = $derived(STATUS_LOOKS[domain][status]);
  const label = $derived(TEXTS[domain].meta[status].label);
  const description = $derived(TEXTS[domain].desc[status]);
</script>

<span
  title={description}
  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold {(onImage
    ? TONES_ON_IMAGE
    : TONES)[look.tone]} {cls}">
  <span data-status-icon={look.icon}>
    <Icon name={look.icon} class="h-3.5 w-3.5" />
  </span>
  {label}
</span>
