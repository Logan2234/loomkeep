import { m } from "#lib/paraglide/messages.js";
import * as env from "$app/env/public";
import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import LegalLinks from "./LegalLinks.svelte";

describe("LegalLinks beta badge", () => {
  afterEach(() => {
    vi.mocked(env).PUBLIC_IS_BETA = undefined;
  });

  // docker-compose.yml defaults the variable to "false": a non-empty string,
  // which a plain truthiness check read as "beta".
  it('stays hidden when PUBLIC_IS_BETA is "false"', () => {
    vi.mocked(env).PUBLIC_IS_BETA = "false";
    render(LegalLinks);

    expect(screen.queryByText(m.common_beta())).toBeNull();
  });

  it('shows when PUBLIC_IS_BETA is "true"', () => {
    vi.mocked(env).PUBLIC_IS_BETA = "true";
    render(LegalLinks);

    expect(screen.getByText(m.common_beta())).toBeTruthy();
  });
});
