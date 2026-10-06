<script lang="ts">
  import { parseChatMarkdown, type ChatNode } from "#lib/chat/chat-markdown.js";
  import { m } from "#lib/paraglide/messages.js";

  let { text }: { text: string } = $props();

  const nodes = $derived(parseChatMarkdown(text));
  let revealed = $state<Set<ChatNode>>(new Set());
</script>

{#snippet render(list: ChatNode[])}
  {#each list as node, i (i)}
    {#if node.type === "text"}{node.text}{:else if node.type === "code"}<code
        class="bg-surface-2 rounded px-1 font-mono text-[0.85em]"
        >{node.text}</code
      >{:else if node.type === "link"}<a
        href={node.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="underline underline-offset-2">{node.href}</a
      >{:else if node.type === "strong"}<strong
        >{@render render(node.children)}</strong
      >{:else if node.type === "em"}<em>{@render render(node.children)}</em
      >{:else if node.type === "strike"}<s>{@render render(node.children)}</s
      >{:else if revealed.has(node)}<span
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

<span class="break-words whitespace-pre-wrap">{@render render(nodes)}</span>
