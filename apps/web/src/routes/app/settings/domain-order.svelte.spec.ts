import { auth } from "#lib/auth.svelte.js";
import { appConfig } from "#lib/config.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import type { UserDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import PrivacySection from "./components/PrivacySection.svelte";
import ImportPage from "./import/+page.svelte";

vi.mock("$app/state", () => import("#lib/test/navigation.svelte.js"));
vi.mock("$app/navigation", () => import("#lib/test/navigation.svelte.js"));

afterEach(() => {
  auth.user = null;
  appConfig.socialEnabled = false;
});

it("orders enabled privacy domains including planned ones", async () => {
  auth.user = {
    enabledDomains: ["MEDIA", "GAMES", "PODCASTS"],
    domainOrder: ["PODCASTS", "GAMES", "MEDIA"],
  } as UserDto;
  appConfig.socialEnabled = true;
  server.use(
    http.get(apiUrl("/social/me/privacy"), () =>
      HttpResponse.json({ profileAccess: "PUBLIC", settings: [] }),
    ),
  );
  const { container } = renderWithQuery(PrivacySection, {});
  await screen.findByText(m.common_Podcasts());
  expect(
    Array.from(
      container.querySelectorAll(
        "section.grid > section > p, div.grid > section > p",
      ),
    ).map((p) => p.textContent?.trim()),
  ).toEqual([m.common_Podcasts(), m.common_Games(), m.common_Media()]);
});

it("orders import groups and excludes disabled domains", async () => {
  auth.user = {
    enabledDomains: ["MEDIA", "GAMES", "BOOKS"],
    domainOrder: ["GAMES", "BOOKS", "MEDIA"],
  } as UserDto;
  server.use(
    http.get(apiUrl("/import/availability"), () => HttpResponse.json({})),
    http.get(apiUrl("/import/quota"), () => HttpResponse.json({})),
    http.get(apiUrl("/import/last-run"), () =>
      HttpResponse.json({ run: null }),
    ),
  );
  const { container, client } = renderWithQuery(ImportPage, {});
  expect(
    Array.from(container.querySelectorAll("section > p.timecode")).map((p) =>
      p.textContent?.trim(),
    ),
  ).toEqual([m.common_Games(), m.common_Books(), m.common_Media()]);
  await waitFor(() => expect(client.isFetching()).toBe(0));
});
