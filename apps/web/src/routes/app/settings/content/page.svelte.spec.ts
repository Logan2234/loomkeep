import { auth } from "$lib/auth.svelte";
import { m } from "$lib/paraglide/messages.js";
import { renderWithQuery } from "$lib/test/render";
import type { UserDto } from "@loomkeep/shared";
import { screen } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import ContentSettings from "./+page.svelte";

vi.mock("$app/state", () => import("$lib/test/navigation.svelte"));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  auth.user = null;
});

it("allows today's local birth date just after midnight", () => {
  vi.stubEnv("TZ", "Europe/Paris");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 4, 0, 30));
  auth.user = { birthDate: null, spoilerSensitivity: "AUTO" } as UserDto;
  renderWithQuery(ContentSettings, {});
  expect(screen.getByLabelText(m.common_birthdate()).getAttribute("max")).toBe(
    "2026-10-04",
  );
});
