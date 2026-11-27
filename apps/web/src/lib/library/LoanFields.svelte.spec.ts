import { m } from "#lib/paraglide/messages.js";
import { renderWithQuery } from "#lib/test/render.js";
import { toast } from "#lib/ui/toast-store.svelte.js";
import { screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoanFields from "./LoanFields.svelte";

const NONE = {
  lentOut: false,
  loanPerson: null,
  loanSince: null,
  loanActive: false,
};
const LENT = { ...NONE, lentOut: true, loanPerson: "Julie", loanActive: true };
const BORROWING = { ...NONE, loanPerson: "Max", loanActive: true };

describe("LoanFields", () => {
  afterEach(() => {
    for (const item of [...toast.items]) toast.dismiss(item.id);
  });

  it("lends a physical copy with a button, before asking to whom", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, { status: "PHYSICAL", loan: NONE, onChange });

    expect(screen.queryByLabelText(m.ownership_lent_to())).toBeNull();
    await user.click(screen.getByRole("button", { name: m.ownership_lend() }));

    expect(onChange).toHaveBeenCalledWith({ lentOut: true });
  });

  it("gets a lent copy back, with an undo", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, { status: "PHYSICAL", loan: LENT, onChange });

    expect(
      screen.getByRole("button", {
        name: m.common_selection_summary({
          label: m.ownership_lent_to(),
          selection: "Julie",
        }),
      }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: m.ownership_lent_returned() }),
    );

    expect(onChange).toHaveBeenCalledWith({ loanReturned: true });
    const [item] = toast.items;
    expect(item?.message).toBe(m.ownership_loan_returned_toast());
    toast.selectAction(item!.id);
    expect(onChange).toHaveBeenLastCalledWith({ loanReturned: false });
  });

  it("asks nothing of a borrowed entry until details are wanted", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, { status: "BORROWED", loan: NONE, onChange });

    expect(screen.queryByLabelText(m.ownership_borrowed_from())).toBeNull();
    expect(
      screen.queryByRole("button", { name: m.ownership_borrowed_given_back() }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: m.ownership_loan_add_details() }),
    );

    // Any name can be kept, not only a friend's.
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(m.ownership_borrowed_from()),
      }),
    );
    await user.type(
      screen.getByRole("combobox", {
        name: m.ownership_loan_person_placeholder(),
      }),
      "  Max ",
    );
    await user.click(
      screen.getByRole("option", {
        name: m.ownership_loan_use_name({ name: "Max" }),
      }),
    );
    expect(onChange).toHaveBeenCalledWith({ loanPerson: "Max" });
    expect(screen.getByText(m.ownership_loan_private())).toBeTruthy();
    // Nothing runs until the entry comes back with its borrowing.
    expect(
      screen.queryByRole("button", { name: m.ownership_borrowed_given_back() }),
    ).toBeNull();
  });

  it("gives a running borrowing back, the status untouched", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, {
      status: "BORROWED",
      loan: BORROWING,
      onChange,
    });

    await user.click(
      screen.getByRole("button", { name: m.ownership_borrowed_given_back() }),
    );

    expect(onChange).toHaveBeenCalledWith({ loanReturned: true });
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ ownershipStatus: expect.anything() }),
    );
  });

  it("clears the person of a running loan", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(LoanFields, { status: "PHYSICAL", loan: LENT, onChange });

    await user.click(
      screen.getByRole("button", { name: new RegExp(m.ownership_lent_to()) }),
    );
    await user.click(screen.getByRole("option", { name: m.common_none() }));

    expect(onChange).toHaveBeenCalledWith({ loanPerson: null });
  });

  it("shows nothing for a digital copy", () => {
    renderWithQuery(LoanFields, {
      status: "DIGITAL",
      loan: NONE,
      onChange: vi.fn(),
    });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
