<script lang="ts">
  import {
    episodeSeries,
    parseChatMarkdown,
    type ChatNode,
  } from "#lib/chat/chat-markdown.js";
  import { chat } from "#lib/chat/chat.svelte.js";
  import { isDomainEnabled } from "#lib/domains.js";
  import { m } from "#lib/paraglide/messages.js";
  import { Domain } from "@loomkeep/shared";

  let {
    text,
    cardHrefs = [],
    fallbackSeries = null,
  }: {
    text: string;
    /** The message's work cards: an episode code may belong to their series. */
    cardHrefs?: string[];
    /** A work's discussion: the series its episode codes mean by default. */
    fallbackSeries?: string | null;
  } = $props();

  const nodes = $derived(parseChatMarkdown(text));
  const series = $derived(episodeSeries(nodes, cardHrefs, fallbackSeries));
  let revealed = $state<Set<ChatNode>>(new Set());

  const DOMAIN_OF_SECTION: Record<string, Domain> = {
    media: Domain.MEDIA,
    games: Domain.GAMES,
    books: Domain.BOOKS,
    music: Domain.MUSIC,
  };

  // A domain the viewer turned off has no page to open.
  function opens(href: string): boolean {
    const section = /^\/app\/([a-z]+)\//.exec(href)?.[1] ?? "";
    const domain = DOMAIN_OF_SECTION[section];
    return !!domain && isDomainEnabled(domain);
  }
</script>

{#snippet render(list: ChatNode[])}
  {#each list as node, i (i)}
    {#if node.type === "text"}<span class="whitespace-pre-wrap"
        >{node.text}</span
      >{:else if node.type === "code"}<code
        class="bg-surface-2 rounded px-1 font-mono text-[0.85em]"
        >{node.text}</code
      >{:else if node.type === "link"}<a
        href={node.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="underline underline-offset-2">{node.href}</a
      >{:else if node.type === "mention"}{#if opens(node.href)}<a
          href={node.href}
          class="text-accent decoration-accent/40 hover:decoration-accent font-semibold underline underline-offset-2 transition-[text-decoration-color] duration-150"
          onclick={() => chat.close()}>#{node.title}</a
        >{:else}<span class="text-dim font-semibold">#{node.title}</span
        >{/if}{:else if node.type === "user"}<a
        href={node.href}
        class="text-accent hover:text-accent/80 font-semibold transition-colors duration-150"
        onclick={() => chat.close()}>{node.label}</a
      >{:else if node.type === "episode"}{#if series && opens(series)}<a
          href="{series}#s{node.season}e{node.episode}"
          class="bg-surface-2 hover:bg-accent/20 rounded px-1 font-mono text-[0.85em] transition-colors duration-150"
          onclick={() => chat.close()}>{node.code}</a
        >{:else}<span class="bg-surface-2 rounded px-1 font-mono text-[0.85em]"
          >{node.code}</span
        >{/if}{:else if node.type === "strong"}<strong
        >{@render render(node.children)}</strong
      >{:else if node.type === "em"}<em>{@render render(node.children)}</em
      >{:else if node.type === "strike"}<s>{@render render(node.children)}</s
      >{:else if node.type === "quote"}<blockquote
        class="border-accent/60 text-dim my-0.5 border-l-2 pl-2.5">
        {@render render(node.children)}
      </blockquote>{:else if node.type === "list"}<ul
        class="my-0.5 list-disc pl-5">
        {#each node.items as item, j (j)}<li>{@render render(item)}</li>{/each}
      </ul>{:else if node.type === "codeblock"}<pre
        class="bg-surface-2 my-1 overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[0.8em] whitespace-pre">{node.text}</pre>{:else if revealed.has(node)}<span
        class="decoration-dim underline decoration-dotted underline-offset-2"
        >{@render render(node.children)}</span
      >{:else}<button
        type="button"
        class="bg-border rounded px-1 text-transparent transition-colors duration-200 [text-shadow:0_0_7px_var(--dim)] hover:[text-shadow:0_0_5px_var(--fg)]"
        aria-label={m.chat_reveal_spoiler()}
        onclick={() => (revealed = new Set(revealed).add(node))}
        >{@render render(node.children)}</button
      >{/if}
  {/each}
{/snippet}

<!-- Line breaks are kept by the text itself: the markup's own indentation
     around quotes and lists must not show. -->
<div class="break-words">{@render render(nodes)}</div>
