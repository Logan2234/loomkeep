import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import { screen } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import UpdateCard from "./UpdateCard.svelte";

beforeEach(() => {
  server.use(
    http.get(apiUrl("/admin/update"), () =>
      HttpResponse.json({
        enabled: true,
        currentVersion: "1.12.0",
        latestVersion: "1.15.0",
        updateAvailable: true,
        checkedAt: null,
        lastCheckFailed: false,
      }),
    ),
    http.get(apiUrl("/admin/backup/files"), () =>
      HttpResponse.json({ files: [] }),
    ),
  );
});

describe("UpdateCard upgrade notes", () => {
  it("lists each point to check before upgrading, under its version", async () => {
    server.use(
      http.get(apiUrl("/admin/update/notes"), () =>
        HttpResponse.json({
          versions: [{ version: "1.15.0", items: ["**Rename** `OMDB_KEY`."] }],
        }),
      ),
    );
    renderWithQuery(UpdateCard, {});

    const point = await screen.findByRole("checkbox");
    expect(point.closest("label")?.textContent).toMatch(/Rename\s*OMDB_KEY\./);
    expect(point.closest("label")?.querySelector("code")?.textContent).toBe(
      "OMDB_KEY",
    );
    expect(screen.getByText("1.15.0")).toBeTruthy();
    expect(
      screen.getByText(m.admin_update_notes_count({ count: 1 })),
    ).toBeTruthy();
  });

  it("says so when no version asks for anything", async () => {
    server.use(
      http.get(apiUrl("/admin/update/notes"), () =>
        HttpResponse.json({ versions: [] }),
      ),
    );
    renderWithQuery(UpdateCard, {});

    expect(await screen.findByText(m.admin_update_notes_none())).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
