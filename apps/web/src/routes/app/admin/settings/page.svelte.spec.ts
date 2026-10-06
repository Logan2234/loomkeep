import { auth } from "#lib/auth.svelte.js";
import { m } from "#lib/paraglide/messages.js";
import { apiUrl, server } from "#lib/test/msw.js";
import { renderWithQuery } from "#lib/test/render.js";
import {
  DEFAULT_INSTANCE_SETTINGS,
  type InstanceSettingsDto,
  type UpdateInstanceSettingsDto,
  type UserDto,
} from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import Page from "./+page.svelte";

let patched: UpdateInstanceSettingsDto | null;

beforeEach(() => {
  patched = null;
  auth.user = { id: "admin", role: "ADMIN" } as UserDto;
  const dto: InstanceSettingsDto = {
    values: { ...DEFAULT_INSTANCE_SETTINGS, socialEnabled: true },
    lockedBy: { socialEnabled: "SOCIAL_ENABLED" },
  };
  server.use(
    http.get(apiUrl("/admin/instance-settings"), () => HttpResponse.json(dto)),
    http.patch(apiUrl("/admin/instance-settings"), async ({ request }) => {
      patched = (await request.json()) as UpdateInstanceSettingsDto;
      return HttpResponse.json({
        ...dto,
        values: { ...dto.values, ...patched },
      });
    }),
  );
});

const toggle = (label: string) =>
  screen.findByRole<HTMLButtonElement>("switch", { name: label });

describe("Admin instance settings", () => {
  it("locks a setting an env var pins and says which one", async () => {
    renderWithQuery(Page, {});

    expect((await toggle(m.common_social())).disabled).toBe(true);
    expect(
      screen.getByText(m.admin_settings_locked({ env: "SOCIAL_ENABLED" })),
    ).toBeTruthy();
  });

  it("saves a switch as soon as it's flipped", async () => {
    const user = userEvent.setup();
    renderWithQuery(Page, {});

    await user.click(await toggle(m.admin_settings_public_api_enabled()));

    await waitFor(() => expect(patched).toEqual({ publicApiEnabled: false }));
  });

  it("saves a rate limit on change, and ignores an out-of-range one", async () => {
    const user = userEvent.setup();
    renderWithQuery(Page, {});
    const free = await screen.findByRole<HTMLInputElement>("spinbutton", {
      name: new RegExp(m.admin_settings_rate_free()),
    });

    await user.clear(free);
    await user.type(free, "0");
    await user.tab();
    expect(patched).toBeNull();
    expect(free.value).toBe("60");

    await user.clear(free);
    await user.type(free, "120");
    await user.tab();
    await waitFor(() => expect(patched).toEqual({ apiRateLimitFree: 120 }));
  });
});
