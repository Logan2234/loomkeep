import { layout } from "#lib/layout.svelte.js";
import type { CommentTargetType } from "@loomkeep/shared";

export type ChatTab = "friends" | "works";

/** A work's discussion to open in the "Œuvres" tab. */
export interface WorkThreadRef {
  targetType: CommentTargetType;
  targetId: string;
  /** The comment a notification or a link points at. */
  focusCommentId?: string | null;
  /** The work's page reveals spoilers by default once it's finished. */
  revealSpoilers?: boolean;
}

const TYPING_SHOWN_MS = 4000;

/**
 * Where Messages stands, shared by the launcher, the panel (desktop), the
 * sheet (compact) and the full-screen page — whichever is on screen reads
 * and drives the same state.
 */
class ChatState {
  /** The floating panel on desktop, the full-screen sheet on the compact shell. */
  open = $state(false);
  /** The rail unfolded into a labelled list, out of the panel's edge. */
  drawer = $state(false);
  tab = $state<ChatTab>("friends");
  activeId = $state<string | null>(null);
  /** The work's discussion the "Œuvres" tab shows. */
  activeWork = $state<WorkThreadRef | null>(null);
  /** The discussion on screen, read as it moves: `type:id`. */
  workOnScreen = $state<string | null>(null);
  /** "Nouveau message": picking a friend instead of reading a conversation. */
  composing = $state(false);
  /** The last page outside Messages: where "Réduire" goes back to. */
  returnTo = $state<string | null>(null);
  /** The conversation the full-screen page shows, while it's mounted. */
  fullscreenId = $state<string | null>(null);
  /** Conversations whose other member is typing right now. */
  typing = $state<Record<string, true>>({});
  /** Friends' presence as it changed since the list was fetched, by user id. */
  presence = $state<Record<string, boolean>>({});

  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Opens Messages, on a conversation or where it was left. */
  show(conversationId?: string): void {
    this.open = true;

    if (conversationId) {
      this.select(conversationId);
    } else if (!this.activeId && !layout.compact) {
      // Nothing to show yet: the labelled list is the panel's home.
      this.drawer = true;
    }
  }

  close(): void {
    this.open = false;
    this.drawer = false;
    this.composing = false;
  }

  select(conversationId: string): void {
    this.tab = "friends";
    this.activeId = conversationId;
    this.composing = false;
    this.drawer = false;
  }

  /** Back to the list, on the compact shell's sheet. */
  back(): void {
    this.activeId = null;
    this.composing = false;
  }

  /** Opens Messages on a work's discussion, from its page or a link. */
  showWork(work: WorkThreadRef): void {
    this.open = true;
    this.tab = "works";
    this.activeWork = work;
    this.composing = false;
    this.drawer = false;
  }

  newMessage(): void {
    this.tab = "friends";
    this.composing = true;
    this.drawer = false;
  }

  /** Whether new messages there are read as they arrive. */
  onScreen(conversationId: string): boolean {
    return (
      this.fullscreenId === conversationId ||
      (this.open && !this.composing && this.activeId === conversationId)
    );
  }

  /** The other member typed: shown for a few seconds unless they type again. */
  markTyping(conversationId: string): void {
    this.typing = { ...this.typing, [conversationId]: true };
    clearTimeout(this.typingTimers.get(conversationId));
    this.typingTimers.set(
      conversationId,
      setTimeout(() => this.stopTyping(conversationId), TYPING_SHOWN_MS),
    );
  }

  /** Their message arrived: they're done typing it. */
  stopTyping(conversationId: string): void {
    clearTimeout(this.typingTimers.get(conversationId));
    this.typingTimers.delete(conversationId);
    const next = { ...this.typing };
    delete next[conversationId];
    this.typing = next;
  }
}

export const chat = new ChatState();

/** Unsent text per conversation: switching conversations keeps each one's. */
export const chatDrafts = new Map<string, string>();
