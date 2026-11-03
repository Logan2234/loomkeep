// A mode a screen is in (a selection) that Android's back button leaves, the
// way it closes a dialog, before walking the history.
const handlers: (() => void)[] = [];

/** Back runs `handler` while registered; returns the way to unregister. */
export function onBackPress(handler: () => void): () => void {
  handlers.push(handler);

  return () => {
    handlers.splice(handlers.indexOf(handler), 1);
  };
}

export function consumeBackPress(): boolean {
  const handler = handlers.at(-1);
  handler?.();
  return !!handler;
}
