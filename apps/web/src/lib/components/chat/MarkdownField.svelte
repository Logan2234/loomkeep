<script lang="ts" module>
  /**
   * Whether the focus sits in a field (MarkdownField) that holds some text:
   * Escape there belongs to the field, not to what's around it.
   */
  export function typingInField(element: Element | null): boolean {
    return (
      element?.closest<HTMLElement>("[data-markdown-field]")?.dataset.empty ===
      "false"
    );
  }
</script>

<script lang="ts">
  // The field Messages and a work's comments are written in: plain text, the
  // way it's sent, shown as it'll read — bold bold, a spoiler hatched — with
  // a span's markers only while the caret is in it. CodeMirror edits the
  // text; it hides a marker without losing it, and keeps the caret, the
  // undo history and phone keyboards right, which a hand-made
  // contenteditable doesn't. It's loaded with the first field shown, not
  // with the app.
  import type { Compartment, StateEffectType } from "@codemirror/state";
  import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
  import {
    composerRunClass,
    composerRuns,
    type Mention,
  } from "#lib/chat/composer-mentions.js";
  import { untrack } from "svelte";

  let {
    value = $bindable(""),
    label,
    placeholder = "",
    mentions = [],
    maxLength,
    class: cls = "",
    oninput,
    onselect,
    onkeydown,
    onblur,
  }: {
    value?: string;
    /** The field's accessible name. */
    label: string;
    placeholder?: string;
    /** Works mentioned with `#`, underlined like links. */
    mentions?: Mention[];
    maxLength?: number;
    class?: string;
    /** The writer changed the text (not `value` set from outside). */
    oninput?: () => void;
    /** The caret or the selection moved, or the field gained or lost focus. */
    onselect?: () => void;
    /** Before the field's own keys: a handler that prevents default wins. */
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: () => void;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view = $state.raw<EditorView | null>(null);
  let refresh: StateEffectType<null> | null = null;
  let described: Compartment | null = null;
  let currentMentions: Mention[] = [];

  // Callbacks may read the layout or move the selection, neither of which
  // CodeMirror allows while it's still applying an update.
  const later = (callback: (() => void) | undefined) => {
    if (callback) queueMicrotask(callback);
  };

  async function create(parent: HTMLElement): Promise<EditorView> {
    const cm = await import("./codemirror");
    const {
      Decoration,
      EditorState,
      EditorView,
      keymap,
      Prec,
      RangeSetBuilder,
      StateEffect,
      ViewPlugin,
    } = cm;
    const refreshEffect = StateEffect.define<null>();
    const compartment = new cm.Compartment();
    refresh = refreshEffect;
    described = compartment;

    const decorate = (view: EditorView): DecorationSet => {
      const { from, to } = view.state.selection.main;
      const runs = composerRuns(
        view.state.doc.toString(),
        currentMentions,
        view.hasFocus ? { start: from, end: to } : null,
      );
      const builder = new RangeSetBuilder<ReturnType<typeof Decoration.mark>>();
      let at = 0;

      for (const run of runs) {
        const end = at + run.text.length;
        if (run.hidden) {
          builder.add(at, end, Decoration.replace({}));
        } else {
          const classes = composerRunClass(run);
          if (classes) {
            builder.add(at, end, Decoration.mark({ class: classes }));
          }
        }
        at = end;
      }

      return builder.finish();
    };

    const live = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = decorate(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.selectionSet ||
            update.focusChanged ||
            update.transactions.some((tr) =>
              tr.effects.some((effect) => effect.is(refreshEffect)),
            )
          ) {
            this.decorations = decorate(update.view);
          }
        }
      },
      { decorations: (plugin) => plugin.decorations },
    );

    return new EditorView({
      parent,
      state: EditorState.create({
        doc: untrack(() => value),
        extensions: [
          cm.history(),
          Prec.highest(
            EditorView.domEventHandlers({
              keydown: (event) => {
                onkeydown?.(event);
                return event.defaultPrevented;
              },
              blur: () => {
                later(onblur);
                return false;
              },
            }),
          ),
          keymap.of([...cm.standardKeymap, ...cm.historyKeymap]),
          EditorView.lineWrapping,
          EditorState.changeFilter.of(
            (tr) => maxLength === undefined || tr.newDoc.length <= maxLength,
          ),
          compartment.of(untrack(() => describe(cm))),
          live,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              value = update.state.doc.toString();
              const synced = update.transactions.some((tr) =>
                tr.isUserEvent("sync"),
              );
              if (!synced) later(oninput);
            }
            if (
              update.docChanged ||
              update.selectionSet ||
              update.focusChanged
            ) {
              later(onselect);
            }
          }),
          EditorView.theme({
            "&": { outline: "none" },
            "&.cm-focused": { outline: "none" },
            ".cm-scroller": {
              fontFamily: "inherit",
              lineHeight: "inherit",
              maxHeight: "8.5rem",
              overflowY: "auto",
              scrollbarWidth: "none",
            },
            ".cm-content": { padding: "0", caretColor: "var(--fg)" },
            ".cm-line": { padding: "0" },
            ".cm-placeholder": { color: "var(--dim)" },
          }),
        ],
      }),
    });
  }

  function describe(cm: typeof import("./codemirror")) {
    return [
      cm.placeholder(placeholder),
      cm.EditorView.contentAttributes.of({
        "aria-label": label,
        "aria-multiline": "true",
        spellcheck: "true",
        autocapitalize: "sentences",
        autocorrect: "on",
      }),
    ];
  }

  $effect(() => {
    if (!host) return;
    let created: EditorView | null = null;
    let gone = false;
    void create(host).then((editor) => {
      if (gone) return editor.destroy();
      created = editor;
      view = editor;
    });
    return () => {
      gone = true;
      created?.destroy();
      view = null;
    };
  });

  /** `value` set from outside (a draft, a picked mention) into the field. */
  function sync() {
    if (!view || value === view.state.doc.toString()) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: value.length },
      userEvent: "sync",
    });
  }

  $effect(() => {
    void value;
    sync();
  });

  $effect(() => {
    currentMentions = mentions;
    if (view && refresh) view.dispatch({ effects: refresh.of(null) });
  });

  $effect(() => {
    void [placeholder, label];
    if (!view || !described) return;
    const compartment = described;
    const editor = view;
    void import("./codemirror").then((cm) =>
      editor.dispatch({ effects: compartment.reconfigure(describe(cm)) }),
    );
  });

  export function focus() {
    view?.focus();
  }

  export function hasFocus(): boolean {
    return view?.hasFocus ?? false;
  }

  export function selection(): { start: number; end: number } {
    const main = view?.state.selection.main;
    return { start: main?.from ?? 0, end: main?.to ?? 0 };
  }

  export function select(start: number, end = start) {
    if (!view) return;
    sync();
    const length = view.state.doc.length;
    view.dispatch({
      selection: {
        anchor: Math.min(start, length),
        head: Math.min(end, length),
      },
      scrollIntoView: true,
    });
  }

  /** Where a character offset sits on screen, for what floats over it. */
  export function coordsAt(
    offset: number,
  ): { left: number; top: number } | null {
    return view?.coordsAtPos(offset) ?? null;
  }
</script>

<div
  bind:this={host}
  class={cls}
  data-markdown-field
  data-empty={value === "" ? "true" : "false"}>
  {#if !view}
    <!-- Keeps the field's line while the editor loads. -->
    <p class="text-dim truncate" aria-hidden="true">
      {value || placeholder || " "}
    </p>
  {/if}
</div>
