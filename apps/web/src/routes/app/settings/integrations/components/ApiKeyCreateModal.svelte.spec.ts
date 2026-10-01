import { m } from "$lib/paraglide/messages.js";
import { apiUrl, server } from "$lib/test/msw";
import { renderWithQuery } from "$lib/test/render";
import type { CreateApiKeyDto, CreatedApiKeyDto } from "@loomkeep/shared";
import { screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECIPES } from "../api-key-form";
import ApiKeyCreateModal from "./ApiKeyCreateModal.svelte";

const SECRET = "lk_test-secret-for-the-modal";

let sent: CreateApiKeyDto | null;

beforeEach(() => {
  sent = null;
  server.use(
    http.post(apiUrl("/api-keys"), async ({ request }) => {
      sent = (await request.json()) as CreateApiKeyDto;
      return HttpResponse.json(
        {
          secret: SECRET,
          apiKey: {
            id: "key-1",
            name: sent.name,
            suffix: SECRET.slice(-4),
            scopes: sent.scopes,
            expiresAt: sent.expiresAt,
            lastUsedAt: null,
            lastUsedIp: null,
            createdAt: "2026-10-01T12:00:00.000Z",
          },
        } satisfies CreatedApiKeyDto,
        { status: 201 },
      );
    }),
  );
});

function renderModal(recipe: (typeof RECIPES)[number] | null = null) {
  const props = $state({ onclose: vi.fn(), recipe });
  renderWithQuery(ApiKeyCreateModal, props);
  return { props, user: userEvent.setup() };
}

const submit = () =>
  screen.getByRole<HTMLButtonElement>("button", {
    name: m.settings_api_keys_create_submit(),
  });
const readBox = (label: string) =>
  screen.getByRole("checkbox", {
    name: `${label} — ${m.settings_api_keys_read()}`,
  });

describe("ApiKeyCreateModal", () => {
  it("can't be submitted until a resource is checked", async () => {
    const { user } = renderModal();

    await user.type(screen.getByRole("textbox"), "Script perso");
    expect(submit().disabled).toBe(true);

    await user.click(readBox(m.common_calendar()));
    expect(submit().disabled).toBe(false);
  });

  it("sends the checked resources as read scopes, then shows the secret once", async () => {
    const { user } = renderModal();

    await user.type(screen.getByRole("textbox"), "Script perso");
    await user.click(readBox(m.settings_api_keys_resource_stats()));
    await user.click(readBox(m.common_library()));
    await user.click(
      screen.getByRole("button", {
        name: m.settings_api_keys_expiration_never(),
      }),
    );
    expect(screen.getByText(m.settings_api_keys_never_warning())).toBeTruthy();
    await user.click(submit());

    await waitFor(() =>
      expect(sent).toEqual({
        name: "Script perso",
        scopes: ["library:read", "stats:read"],
        expiresAt: null,
      }),
    );
    const secret = await screen.findByRole<HTMLInputElement>("textbox", {
      name: m.settings_api_keys_detail_key(),
    });
    expect(secret.value).toBe(SECRET);
  });

  it("starts from a recipe's name and resources, then shows a matching example", async () => {
    const backup = RECIPES.find((recipe) => recipe.id === "backup")!;
    const { user } = renderModal(backup);

    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe(
      m.settings_api_keys_recipe_backup_name(),
    );
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: `${m.settings_api_keys_resource_export()} — ${m.settings_api_keys_read()}`,
      }).checked,
    ).toBe(true);

    await user.click(submit());

    await waitFor(() => expect(sent?.scopes).toEqual(["export:read"]));
    expect(await screen.findByText(/\/v1\/export/)).toBeTruthy();
  });

  it("checks every resource at once", async () => {
    const { user } = renderModal();

    await user.click(
      screen.getByRole("button", { name: m.settings_api_keys_all_read() }),
    );

    const boxes = screen
      .getAllByRole<HTMLInputElement>("checkbox")
      .filter((box) => !box.disabled);
    expect(boxes.every((box) => box.checked)).toBe(true);
  });
});
