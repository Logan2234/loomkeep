import { formatLanguage } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import { getLocale } from "#lib/paraglide/runtime.js";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import GameLanguagePill from "./GameLanguagePill.svelte";

const language = formatLanguage(getLocale());

describe("GameLanguagePill", () => {
  it("opens every language with its three columns on a tap", async () => {
    const user = userEvent.setup();
    render(GameLanguagePill, {
      languages: [
        { locale: "ja-JP", interface: true, subtitles: true, audio: true },
        {
          locale: getLocale(),
          interface: true,
          subtitles: true,
          audio: false,
        },
      ],
    });

    await user.click(
      screen.getByRole("button", { name: m.game_language_text({ language }) }),
    );

    const table = within(screen.getByRole("dialog")).getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1].textContent).toContain(formatLanguage(getLocale()));
    expect(
      within(table).getByRole("columnheader", {
        name: m.game_languages_audio(),
      }),
    ).toBeTruthy();
  });

  it("says nothing when IGDB lists no language", () => {
    render(GameLanguagePill, { languages: [] });

    expect(screen.queryByRole("button")).toBeNull();
  });
});
