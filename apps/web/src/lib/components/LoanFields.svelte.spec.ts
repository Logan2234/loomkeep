import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import { fireEvent, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoanFields from "./LoanFields.svelte";

const NONE = { lentOut: false, loanPerson: null, loanSince: null };

describe("LoanFields", () => {
  it("offers to mark a physical copy lent out, then asks to whom", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, { status: "PHYSICAL", loan: NONE, onChange });

    expect(screen.queryByLabelText(m.ownership_lent_to())).toBeNull();
    await user.click(
      screen.getByRole("checkbox", { name: m.ownership_lent_out() }),
    );

    expect(onChange).toHaveBeenCalledWith({ lentOut: true });
  });

  it("asks who a borrowed work came from and saves the name", async () => {
    const onChange = vi.fn();
    renderWithQuery(LoanFields, { status: "BORROWED", loan: NONE, onChange });

    const person = screen.getByLabelText(m.ownership_borrowed_from());
    await fireEvent.change(person, { target: { value: "  Julie " } });

    expect(onChange).toHaveBeenCalledWith({ loanPerson: "Julie" });
    expect(screen.getByText(m.ownership_loan_private())).toBeTruthy();
  });

  it("shows nothing for a digital copy", () => {
    renderWithQuery(LoanFields, {
      status: "DIGITAL",
      loan: NONE,
      onChange: vi.fn(),
    });

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
