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
  import type { IconName } from "#lib/types/icon-name.js";
  import type {
    BookStatus,
    EntryStatus,
    GameStatus,
    MusicStatus,
  } from "@loomkeep/shared";
  import Icon from "./Icon.svelte";

  type Tone = "idle" | "active" | "done" | "dropped";
  type Look = { tone: Tone; icon: IconName };

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

  const LOOKS: Record<typeof domain, Record<string, Look>> = {
    MEDIA: {
      PLANNED: { tone: "idle", icon: "tv" },
      WATCHING: { tone: "active", icon: "play" },
      UP_TO_DATE: { tone: "done", icon: "calendar" },
      COMPLETED: { tone: "done", icon: "check" },
      DROPPED: { tone: "dropped", icon: "x" },
    },
    BOOKS: {
      TO_READ: { tone: "idle", icon: "book" },
      READING: { tone: "active", icon: "book-open" },
      READ: { tone: "done", icon: "check" },
      DROPPED: { tone: "dropped", icon: "x" },
    },
    GAMES: {
      BACKLOG: { tone: "idle", icon: "gamepad" },
      PLAYING: { tone: "active", icon: "play" },
      COMPLETED: { tone: "done", icon: "check" },
      DROPPED: { tone: "dropped", icon: "x" },
    },
    MUSIC: {
      TO_LISTEN: { tone: "idle", icon: "music" },
      LISTENED: { tone: "done", icon: "check" },
    },
  };

  const TEXTS: Record<
    typeof domain,
    { meta: Record<string, { label: string }>; desc: Record<string, string> }
  > = {
    MEDIA: { meta: MEDIA_STATUS_META, desc: MEDIA_STATUS_DESC },
    BOOKS: { meta: BOOK_STATUS_META, desc: BOOK_STATUS_DESC },
    GAMES: { meta: GAME_STATUS_META, desc: GAME_STATUS_DESC },
    MUSIC: { meta: MUSIC_STATUS_META, desc: MUSIC_STATUS_DESC },
  };

  const TONES: Record<Tone, string> = {
    idle: "bg-surface-2 text-dim",
    active: "bg-accent/12 text-accent",
    done: "bg-success/12 text-success",
    dropped: "bg-danger/10 text-danger",
  };

  // Solid fills: the theme's tinted ones vanish on a dark backdrop in light mode.
  const TONES_ON_IMAGE: Record<Tone, string> = {
    idle: "bg-white/15 text-white backdrop-blur",
    active: "bg-accent text-accent-fg",
    done: "bg-success text-bg",
    dropped: "bg-danger text-bg",
  };

  const look = $derived(LOOKS[domain][status]);
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
