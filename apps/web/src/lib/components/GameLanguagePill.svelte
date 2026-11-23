<script lang="ts">
  import { formatLanguage } from "#lib/format.js";
  import {
    gameLanguageLevel,
    viewerLanguageFirst,
  } from "#lib/game-languages.js";
  import { getLocale } from "#lib/paraglide/runtime.js";
  import { m } from "#lib/paraglide/messages.js";
  import type { GameLanguageDto } from "@loomkeep/shared";
  import { isFeatureNew } from "#lib/feature-badges.js";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";
  import NewBadge from "./NewBadge.svelte";

  // Whether a game exists in the viewer's language, in the hero next to its
  // platforms; a tap lists every language IGDB knows, with what it covers.
  let { languages }: { languages: GameLanguageDto[] } = $props();

  const locale = getLocale();
  const level = $derived(gameLanguageLevel(languages, locale));
  const language = formatLanguage(locale);
  const rows = $derived(viewerLanguageFirst(languages, locale));
  const isMine = (row: GameLanguageDto) =>
    row.locale.split("-")[0].toLowerCase() === locale.split("-")[0];

  let open = $state(false);
</script>

{#if level}
  <button
    type="button"
    class="rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors {level ===
    'full'
      ? 'border-success text-success'
      : level === 'text'
        ? 'border-accent text-accent'
        : 'border-border text-dim'}"
    onclick={() => (open = true)}>
    {level === "full"
      ? m.game_language_full({ language })
      : level === "text"
        ? m.game_language_text({ language })
        : m.game_language_none({ language })}
  </button>
  {#if isFeatureNew("game-languages")}<NewBadge />{/if}
{/if}

{#if open}
  <Modal title={m.game_languages_title()} onclose={() => (open = false)}>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-dim text-micro font-mono tracking-wide uppercase">
            <th class="py-1.5 pr-3 text-left font-normal">
              {m.common_language()}
            </th>
            <th class="px-2 py-1.5 font-normal">
              {m.game_languages_interface()}
            </th>
            <th class="px-2 py-1.5 font-normal">
              {m.game_languages_subtitles()}
            </th>
            <th class="px-2 py-1.5 font-normal">{m.game_languages_audio()}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.locale)}
            <tr
              class="border-surface-2 border-t"
              class:font-semibold={isMine(row)}>
              <td class="py-1.5 pr-3">{formatLanguage(row.locale)}</td>
              {#each [row.interface, row.subtitles, row.audio] as supported, i (i)}
                <td class="px-2 py-1.5 text-center">
                  {#if supported}
                    <Icon name="check" class="text-success inline h-4 w-4" />
                    <span class="sr-only">{m.common_yes()}</span>
                  {:else}
                    <span class="text-dim" aria-hidden="true">–</span>
                    <span class="sr-only">{m.common_no()}</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-dim mt-3 text-xs">{m.game_languages_source()}</p>
  </Modal>
{/if}
