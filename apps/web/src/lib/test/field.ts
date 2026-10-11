import { EditorView } from "@codemirror/view";

function editorOf(box: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(box);
  if (!view) throw new Error("Not a composer's field (MarkdownField)");
  return view;
}

/** What a composer's field holds: the text as it'll be sent, markers and all. */
export function fieldText(box: HTMLElement): string {
  return editorOf(box).state.doc.toString();
}

/** Selects part of a composer's field, as dragging over it would. */
export function selectInField(box: HTMLElement, start: number, end: number) {
  const view = editorOf(box);
  view.focus();
  view.dispatch({ selection: { anchor: start, head: end } });
}

/**
 * Focuses a composer's field with the caret at its end, ready for
 * `user.type(box, …, { skipClick: true })`: user-event's own click would land
 * at the very start, happy-dom having no layout to point into.
 */
export async function focusField(box: HTMLElement) {
  const view = editorOf(box);
  view.focus();
  view.dispatch({ selection: { anchor: view.state.doc.length } });
  // The selection reaches CodeMirror through a queued `selectionchange`.
  await new Promise((resolve) => setTimeout(resolve));
}
