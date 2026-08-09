<script lang="ts">
  import type { IconName } from "$lib/types/icon-name";

  let { name, class: cls = "h-5 w-5" }: { name: IconName; class?: string } =
    $props();
</script>

<svg
  class={cls}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true">
  {#if name === "home"}
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
  {:else if name === "library"}
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  {:else if name === "calendar"}
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  {:else if name === "stats"}
    <rect x="4" y="12" width="4" height="8" rx="1" />
    <rect x="10" y="7" width="4" height="13" rx="1" />
    <rect x="16" y="10" width="4" height="10" rx="1" />
  {:else if name === "user"}
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  {:else if name === "users"}
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M17.5 14.2c2 .6 3.5 2 3.5 4.8" />
  {:else if name === "activity"}
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  {:else if name === "menu"}
    <path d="M4 6h16M4 12h16M4 18h16" />
  {:else if name === "sun"}
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  {:else if name === "moon"}
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  {:else if name === "check"}
    <path d="M5 12.5 10 17.5 20 6.5" />
  {:else if name === "star"}
    <path
      d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  {:else if name === "gamepad"}
    <rect x="2" y="7" width="20" height="10" rx="5" />
    <path d="M7 12h3M8.5 10.5v3M15.5 11h.01M18 13.5h.01" />
  {:else if name === "book"}
    <path
      d="M6 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M4 18h13" />
  {:else if name === "chevron-left"}
    <path d="M15 6l-6 6 6 6" />
  {:else if name === "chevron-right"}
    <path d="M9 6l6 6-6 6" />
  {:else if name === "chevron-up"}
    <path d="M6 15l6-6 6 6" />
  {:else if name === "chevron-down"}
    <path d="M6 9l6 6 6-6" />
  {:else if name === "download"}
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  {:else if name === "bell"}
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10.5 20a1.8 1.8 0 0 0 3 0" />
  {:else if name === "monitor"}
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  {:else if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "trash"}
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  {:else if name === "x"}
    <path d="M6 6l12 12M18 6 6 18" />
  {:else if name === "eye"}
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "eye-off"}
    <path
      d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M7.4 7.6C4.7 9.1 3 12 3 12s3.5 7 10 7c1.6 0 3-.4 4.2-1M9.9 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7s-.8 1.6-2.3 3.1" />
  {:else if name === "shield"}
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    <path d="M9.5 12l1.8 1.8L15 10" />
  {:else if name === "mail"}
    <path d="M3 5h18v14H3z" />
    <path d="M3 6l9 7 9-7" />
  {:else if name === "database"}
    <path d="M12 5c4.4 0 8 1.1 8 2.5S16.4 10 12 10s-8-1.1-8-2.5S7.6 5 12 5Z" />
    <path d="M4 7.5V12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V7.5" />
    <path d="M4 12v4.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V12" />
  {:else if name === "gauge"}
    <path d="M4 16a8 8 0 0 1 16 0" />
    <path d="M12 16l4-5" />
    <circle cx="12" cy="16" r="1.3" />
  {:else if name === "archive"}
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
    <path d="M10 13h4" />
  {:else if name === "music"}
    <path d="M9 18V4l11-2v14" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  {:else if name === "tv"}
    <path d="M9 3l3 3 3-3" />
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M8 21h8" />
  {:else if name === "podcast"}
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" />
  {:else if name === "boardgame"}
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
  {:else if name === "refresh"}
    <path d="M4 12a8 8 0 0 1 14-5.3L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-14 5.3L4 16" />
    <path d="M4 20v-4h4" />
  {:else if name === "gear"}
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  {:else if name === "pin"}
    <!-- Outline map-pin: "not pinned" state. -->
    <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.2" />
  {:else if name === "pin-filled"}
    <!-- Solid map-pin: "pinned" state — same silhouette, filled. -->
    <path
      d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z"
      fill="currentColor"
      stroke="none" />
  {:else if name === "message"}
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
  {:else if name === "flag"}
    <path d="M5 21V4" />
    <path d="M5 5c2-1.5 4-1.5 6 0s4 1.5 6 0v9c-2 1.5-4 1.5-6 0s-4-1.5-6 0Z" />
  {:else if name === "reply"}
    <path d="M10 5 3 12l7 7" />
    <path d="M3 12h9c4 0 8 2 8 7" />
  {:else if name === "list"}
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
  {:else if name === "edit"}
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14 6.5 17.5 10" />
  {:else if name === "grip"}
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
  {:else if name === "dots-horizontal"}
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  {:else if name === "dots-vertical"}
    <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
  {:else if name === "share"}
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" />
  {:else if name === "qr-code"}
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M20 14v3h-3M14 20h3v.01M20 20v.01" />
  {:else if name === "camera"}
    <path
      d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="12.5" r="3.5" />
  {:else if name === "link"}
    <path d="M9 12h6" />
    <path
      d="M8.5 15.5H7a3.5 3.5 0 0 1 0-7h1.5M15.5 8.5H17a3.5 3.5 0 0 1 0 7h-1.5" />
  {:else if name === "logout"}
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  {:else if name === "sparkles"}
    <path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6Z" />
    <path d="M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" />
  {/if}
</svg>
