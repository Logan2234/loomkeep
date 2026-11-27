import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProgressBar from "./ProgressBar.svelte";

describe("ProgressBar", () => {
  it("can mark reading progress with a bookmark end cap", () => {
    const { container } = render(ProgressBar, {
      props: { value: 42, label: "Reading progress", endCap: "bookmark" },
    });

    expect(container.querySelector('[data-end-cap="bookmark"]')).toBeTruthy();
  });
});
