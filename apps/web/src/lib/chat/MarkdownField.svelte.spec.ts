import { fieldText, focusField, selectInField } from "#lib/test/field.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import MarkdownField from "./MarkdownField.svelte";

async function setup() {
  render(MarkdownField, { label: "Message" });
  const box = await screen.findByRole("textbox", { name: "Message" });
  await focusField(box);
  return box;
}

describe("MarkdownField", () => {
  // The editor's code loads on its own; an empty box collapsed to its border.
  it("keeps its line, with the placeholder, while the editor loads", async () => {
    render(MarkdownField, { label: "Message", placeholder: "Écris à Léa" });

    expect(screen.getByText("Écris à Léa")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBe(null);
    await screen.findByRole("textbox", { name: "Message" });
  });

  it("drops a span's markers, place and all, until the caret goes in", async () => {
    const user = userEvent.setup();
    const box = await setup();

    await user.type(box, "Le **final** de ||Dark|| ok", { skipClick: true });

    // The text keeps them; the field doesn't show them.
    expect(fieldText(box)).toBe("Le **final** de ||Dark|| ok");
    expect(box.textContent).toBe("Le final de Dark ok");

    selectInField(box, 7, 7);
    await new Promise((resolve) => setTimeout(resolve));
    expect(box.textContent).toBe("Le **final** de Dark ok");
  });

  it("draws bold bold and a spoiler hatched", async () => {
    const user = userEvent.setup();
    const box = await setup();

    await user.type(box, "**gras** ||chut|| ", { skipClick: true });

    expect(screen.getByText("gras").className).toContain("font-bold");
    expect(screen.getByText("chut").className).toContain("repeating-linear");
  });
});
