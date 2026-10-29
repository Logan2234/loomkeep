import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NoteField from "./NoteField.svelte";

describe("NoteField", () => {
  it("is named after its visible label, not its placeholder", () => {
    render(NoteField, {
      placeholder: "What did you think?",
      onChange: vi.fn(),
    });

    expect(
      screen.getByRole("textbox", { name: m.notefield_label() }),
    ).toBeTruthy();
  });
});
