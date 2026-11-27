// The CodeMirror pieces MarkdownField uses, behind one dynamic import: three
// separate `import()`s let the bundler copy @codemirror/view into two chunks.
export { history, historyKeymap, standardKeymap } from "@codemirror/commands";
export {
  Compartment,
  EditorState,
  Prec,
  RangeSetBuilder,
  StateEffect,
} from "@codemirror/state";
export {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  placeholder,
} from "@codemirror/view";
