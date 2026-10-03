import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReportModal from "./ReportModal.svelte";

function renderModal(targetType: "USER" | "LIST") {
  const onSubmit = vi.fn();
  render(ReportModal, {
    props: { title: "Signaler", targetType, onClose: vi.fn(), onSubmit },
  });
  return { onSubmit, user: userEvent.setup() };
}

const part = (name: string) => screen.getByRole("button", { name });
const category = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("ReportModal", () => {
  it("asks which part of a profile is wrong before offering categories", async () => {
    const { user } = renderModal("USER");

    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${m.report_category_violence()}`),
      }),
    ).toBeNull();

    await user.click(part(m.report_part_photo()));

    expect(category(m.report_category_violence())).toBeTruthy();
  });

  it("only offers the categories that can happen on the chosen part", async () => {
    const { user } = renderModal("USER");

    await user.click(part(m.common_name()));

    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${m.report_category_violence()}`),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${m.report_category_noncompliant()}`),
      }),
    ).toBeNull();
  });

  it("files the part along with the category and motif", async () => {
    const { user, onSubmit } = renderModal("USER");

    await user.click(part(m.report_part_behaviour()));
    await user.click(category(m.report_category_noncompliant()));
    await user.click(
      screen.getByRole("radio", { name: m.report_motif_account_bot() }),
    );
    await user.click(screen.getByRole("button", { name: m.common_report() }));

    expect(onSubmit).toHaveBeenCalledWith({
      category: "NONCOMPLIANT_ACCOUNT",
      motif: "ACCOUNT_BOT",
      reason: undefined,
      profilePart: "BEHAVIOUR",
    });
  });

  it("requires the law at stake for another offence", async () => {
    const { user } = renderModal("LIST");

    await user.click(category(m.report_category_illegal()));
    await user.click(
      screen.getByRole("radio", { name: m.report_motif_illegal_other() }),
    );
    const send = screen.getByRole("button", { name: m.common_report() });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    await user.type(
      screen.getByRole("textbox", { name: m.report_law_placeholder() }),
      "Loi du 29 juillet 1881",
    );
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });
});
