import { render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkSocialSection from "./WorkSocialSection.svelte";
const { config } = vi.hoisted(() => ({ config: { socialEnabled: true } }));
vi.mock("#lib/config.svelte.js", () => ({ appConfig: config }));
vi.mock(
  "./ReviewsSection.svelte",
  () => import("#lib/test/ReviewSectionStub.svelte"),
);
vi.mock(
  "./CommentsPanel.svelte",
  () => import("#lib/test/CommentsPanelStub.svelte"),
);
const props = {
  targetType: "GAME" as const,
  reviewTargetId: "game",
  commentTargetId: "comments",
  title: "Game",
  meta: "2026",
  imageUrl: null,
  canParticipate: true,
};
beforeEach(() => {
  config.socialEnabled = true;
});
describe("WorkSocialSection", () => {
  it("renders comments once alongside reviews for a tracked work", () => {
    render(WorkSocialSection, props);
    expect(screen.getByTestId("reviews").textContent).toContain("game");
    expect(screen.getAllByTestId("comments")).toHaveLength(1);
    expect(
      screen.getByTestId("comments").getAttribute("data-can-participate"),
    ).toBe("true");
  });
  it("keeps standalone read-only comments for an untracked work", () => {
    render(WorkSocialSection, {
      ...props,
      reviewTargetId: null,
      canParticipate: false,
    });
    expect(screen.queryByTestId("reviews")).toBeNull();
    expect(
      screen.getByTestId("comments").getAttribute("data-can-participate"),
    ).toBe("false");
  });
  it("keeps participation for a tracked upcoming game without displaying reviews", () => {
    render(WorkSocialSection, { ...props, reviewTargetId: null });
    expect(screen.queryByTestId("reviews")).toBeNull();
    expect(
      screen.getByTestId("comments").getAttribute("data-can-participate"),
    ).toBe("true");
  });
  it("hides comments when social features are disabled without hiding reviews", () => {
    config.socialEnabled = false;
    render(WorkSocialSection, props);
    expect(screen.getByTestId("reviews")).toBeTruthy();
    expect(screen.queryByTestId("comments")).toBeNull();
  });
});
