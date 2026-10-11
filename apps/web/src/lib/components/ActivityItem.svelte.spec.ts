import type { ActivityEventDto } from "@loomkeep/shared";
import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ActivityItem from "./ActivityItem.svelte";
const event = {
  id: "event",
  actor: { username: "alice", displayName: "Alice", avatarUrl: null },
  kind: "REVIEW_POSTED",
  targetType: "MEDIA",
  targetId: "media",
  title: "Film",
  href: "/app/media/movie/1",
  imageUrl: "/broken-cover.jpg",
  createdAt: "2026-10-01T12:00:00Z",
  data: {},
} as ActivityEventDto;
describe("activity cover fallback", () => {
  it("replaces a failed artwork instead of leaving a broken image", async () => {
    const { container } = render(ActivityItem, { event });
    const image = container.querySelector<HTMLImageElement>(
      'img[src="/broken-cover.jpg"]',
    );
    expect(image).not.toBeNull();
    await fireEvent.error(image!);
    await waitFor(() =>
      expect(
        container.querySelector('img[src="/broken-cover.jpg"]'),
      ).toBeNull(),
    );
  });
});
