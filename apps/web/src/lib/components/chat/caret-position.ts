/**
 * Where a character offset of a textarea sits, relative to the textarea's
 * box: a hidden copy with the same metrics lays the text out up to it.
 * Textareas expose no geometry for their selection otherwise.
 */
export function caretPosition(
  textarea: HTMLTextAreaElement,
  offset: number,
): { left: number; top: number } {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");

  for (const property of [
    "boxSizing",
    "width",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
  ] as const) {
    mirror.style[property] = style[property];
  }

  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    borderStyle: "solid",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });
  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.append(marker);
  document.body.append(mirror);

  const position = {
    left: marker.offsetLeft,
    top: marker.offsetTop - textarea.scrollTop,
  };
  mirror.remove();
  return position;
}
