import { m } from "$lib/paraglide/messages.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Combobox from "./Combobox.svelte";

const GENRES = [
  { label: "Drama", value: "drama" },
  { label: "Comedy", value: "comedy" },
  { label: "Horror", value: "horror", disabled: true },
  { label: "Thriller", value: "thriller" },
];

type Props = {
  options?: typeof GENRES;
  values?: string[];
  multiselect?: boolean;
  searchable?: boolean;
  onSearch?: (query: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  name?: string;
  disabled?: boolean;
};

// Controlled like every real caller: the parent owns `values` and writes
// back what onChange reports.
function renderCombobox(overrides: Props = {}) {
  const props = $state({
    label: "Genre",
    options: GENRES,
    values: [] as string[],
    ...overrides,
    onChange: vi.fn((values: string[]) => (props.values = values)),
  });
  const result = render(Combobox, { props });
  return { ...result, props, user: userEvent.setup() };
}

const trigger = () => screen.getByRole("combobox");
const listbox = () => screen.getByRole("listbox", { name: "Genre" });
const option = (name: string) => screen.getByRole("option", { name });
const activeOption = () =>
  document.getElementById(trigger().getAttribute("aria-activedescendant")!);

describe("Combobox", () => {
  describe("single choice", () => {
    it("names the trigger after its label, then after the pick", () => {
      const { unmount } = renderCombobox();
      expect(trigger().getAttribute("aria-label")).toBe("Genre");
      unmount();

      renderCombobox({ values: ["comedy"] });
      expect(trigger().getAttribute("aria-label")).toBe(
        m.common_selection_summary({ label: "Genre", selection: "Comedy" }),
      );
    });

    it("picks an option and closes, handing focus back", async () => {
      const { props, user } = renderCombobox();

      await user.click(trigger());
      expect(trigger().getAttribute("aria-expanded")).toBe("true");
      await user.click(option("Comedy"));

      expect(props.onChange).toHaveBeenCalledWith(["comedy"]);
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(trigger().getAttribute("aria-expanded")).toBe("false");
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
    });

    it("is driven entirely from the keyboard", async () => {
      const { props, user } = renderCombobox();
      trigger().focus();

      await user.keyboard("{ArrowDown}");
      expect(listbox()).toBeTruthy();
      expect(activeOption()?.textContent).toContain("Drama");

      // Horror is disabled, so the active option skips over it.
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(activeOption()?.textContent).toContain("Thriller");

      await user.keyboard("{Enter}");
      expect(props.onChange).toHaveBeenCalledWith(["thriller"]);
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("opens on the last option with ArrowUp and wraps around", async () => {
      const { user } = renderCombobox();
      trigger().focus();

      await user.keyboard("{ArrowUp}");
      expect(activeOption()?.textContent).toContain("Thriller");

      await user.keyboard("{ArrowDown}");
      expect(activeOption()?.textContent).toContain("Drama");
    });

    it("starts from the current pick when reopened", async () => {
      const { user } = renderCombobox({ values: ["thriller"] });
      trigger().focus();

      await user.keyboard("{ArrowDown}");

      expect(activeOption()?.textContent).toContain("Thriller");
      expect(option("Thriller").getAttribute("aria-selected")).toBe("true");
    });

    it("closes on Escape without picking anything", async () => {
      const { props, user } = renderCombobox();
      await user.click(trigger());

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).toBeNull();
      expect(props.onChange).not.toHaveBeenCalled();
    });

    it("never picks a disabled option", async () => {
      const { props, user } = renderCombobox();
      await user.click(trigger());

      await user.click(option("Horror"));

      expect(props.onChange).not.toHaveBeenCalled();
    });

    it("can't be opened while disabled", async () => {
      const { user } = renderCombobox({ disabled: true });

      await user.click(trigger());

      expect(screen.queryByRole("listbox")).toBeNull();
    });
  });

  describe("multiple choice", () => {
    it("toggles options and stays open", async () => {
      const { props, user } = renderCombobox({ multiselect: true });
      await user.click(trigger());
      expect(listbox().getAttribute("aria-multiselectable")).toBe("true");

      await user.click(option("Drama"));
      await user.click(option("Thriller"));
      await user.click(option("Drama"));

      expect(props.onChange.mock.calls.map(([values]) => values)).toEqual([
        ["drama"],
        ["drama", "thriller"],
        ["thriller"],
      ]);
      expect(listbox()).toBeTruthy();
      expect(option("Thriller").getAttribute("aria-selected")).toBe("true");
    });

    it("summarises how many options are picked", () => {
      renderCombobox({ multiselect: true, values: ["drama", "comedy"] });

      expect(trigger().getAttribute("aria-label")).toBe(
        m.common_selection_summary({ label: "Genre", selection: "2" }),
      );
    });
  });

  describe("search", () => {
    it("filters the options locally as the user types", async () => {
      const { user } = renderCombobox({ searchable: true });
      await user.click(screen.getByRole("button", { name: "Genre" }));

      await user.type(
        screen.getByRole("combobox", { name: m.common_search_placeholder() }),
        "dra",
      );

      expect(
        within(listbox())
          .getAllByRole("option")
          .map((o) => o.textContent?.trim()),
      ).toEqual(["Drama"]);
    });

    it("says so when nothing matches", async () => {
      const { user } = renderCombobox({ searchable: true });
      await user.click(screen.getByRole("button", { name: "Genre" }));

      await user.type(
        screen.getByRole("combobox", { name: m.common_search_placeholder() }),
        "western",
      );

      expect(screen.getByRole("status").textContent).toContain(
        m.common_no_results(),
      );
    });

    it("leaves filtering to the server when it searches remotely", async () => {
      const onSearch = vi.fn();
      const { user } = renderCombobox({ searchable: true, onSearch });
      await user.click(screen.getByRole("button", { name: "Genre" }));

      await user.type(
        screen.getByRole("combobox", { name: m.common_search_placeholder() }),
        "dra",
      );

      expect(onSearch).toHaveBeenLastCalledWith("dra");
      expect(within(listbox()).getAllByRole("option")).toHaveLength(4);
    });

    it("picks the active match with Enter from the search field", async () => {
      const { props, user } = renderCombobox({ searchable: true });
      await user.click(screen.getByRole("button", { name: "Genre" }));

      await user.keyboard("thr{Enter}");

      expect(props.onChange).toHaveBeenCalledWith(["thriller"]);
    });
  });

  it("offers the next page of a paginated list", async () => {
    const onLoadMore = vi.fn();
    const { user } = renderCombobox({ hasMore: true, onLoadMore });
    await user.click(trigger());

    await user.click(
      screen.getByRole("button", { name: m.common_load_more() }),
    );

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("submits its values with an enclosing form under its name", () => {
    const { container } = renderCombobox({
      multiselect: true,
      name: "genres",
      values: ["drama", "thriller"],
    });

    const form = document.createElement("form");
    form.append(...container.childNodes);

    expect(new FormData(form).getAll("genres")).toEqual(["drama", "thriller"]);
  });
});
