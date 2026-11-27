import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import StatsPremiumBlock from "./StatsPremiumBlock.svelte";

describe("the premium block of the statistics", () => {
  it("says what is reserved and shows blurred previews under a lock", () => {
    render(StatsPremiumBlock);

    expect(screen.getByText(m.stats_premium_block())).toBeTruthy();

    for (const title of [
      m.stats_rating_distribution(),
      m.stats_decade(),
      m.stats_possession(),
      m.stats_temporal_section(),
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });
});
