import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { vi } from "vitest";
import { NewsletterWebhookController } from "./newsletter-webhook.controller";
import type { NewsletterService } from "./newsletter.service";

/**
 * The payload shape was inferred from a Quackback changelog entry rather than
 * a real delivery (see the controller's own note), so its defensive reading is
 * the point: a delivery that does not look like a changelog must be refused
 * loudly instead of sending a newsletter built from nothing.
 */
function payload(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "changelog_published" as const,
    createdAt: new Date(),
    data: {
      changelog: {
        id: "changelog_42",
        title: "Version 1.9.0",
        contentPreview: "Imports Letterboxd et IMDb",
        contentHtml: "<p>Imports Letterboxd et IMDb</p>",
        publishedAt: new Date(),
        linkedPostCount: 2,
        ...over,
      },
    },
  };
}

function makeController() {
  const newsletter = {
    handleChangelogPublished: vi.fn().mockResolvedValue(undefined),
  } as unknown as NewsletterService;
  const controller = new NewsletterWebhookController(newsletter);
  vi.spyOn(controller["logger"], "warn").mockImplementation(() => undefined);
  return { controller, newsletter };
}

describe("NewsletterWebhookController.changelogPublished", () => {
  it("forwards a well-formed changelog to the newsletter", async () => {
    const { controller, newsletter } = makeController();

    const result = await controller.changelogPublished(payload());

    expect(result).toEqual({ ok: true });
    expect(newsletter.handleChangelogPublished).toHaveBeenCalledWith(
      "changelog_42",
      "Version 1.9.0",
      "Imports Letterboxd et IMDb",
      "<p>Imports Letterboxd et IMDb</p>",
    );
  });

  it("refuses an id that is not a changelog's", async () => {
    // Quackback fires one webhook type per event, but the payload carries the
    // entity id: a post id here would mean the wrong thing was published.
    const { controller, newsletter } = makeController();

    await expect(
      controller.changelogPublished(payload({ id: "post_42" })),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.NewsletterWebhookInvalidPayload,
    });
    expect(newsletter.handleChangelogPublished).not.toHaveBeenCalled();
  });

  it.each([
    ["title", { title: "" }],
    ["preview", { contentPreview: "" }],
  ])("refuses a delivery with no %s", async (_what, over) => {
    // Both end up in the email: sending one with an empty subject or body
    // would reach every subscriber before anyone noticed.
    const { controller, newsletter } = makeController();

    await expect(
      controller.changelogPublished(payload(over)),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(newsletter.handleChangelogPublished).not.toHaveBeenCalled();
  });

  it("logs the body it could not read, so the real shape can be found", async () => {
    const { controller } = makeController();

    await expect(
      controller.changelogPublished(payload({ id: "nope" })),
    ).rejects.toThrow();

    expect(controller["logger"].warn).toHaveBeenCalledWith(
      expect.stringContaining("nope"),
    );
  });

  it("accepts a changelog with no HTML body, falling back to empty", async () => {
    // contentHtml is the only optional field: the preview alone is enough to
    // build the email.
    const { controller, newsletter } = makeController();

    await controller.changelogPublished(
      payload({ contentHtml: undefined }) as never,
    );

    expect(newsletter.handleChangelogPublished).toHaveBeenCalledWith(
      "changelog_42",
      "Version 1.9.0",
      "Imports Letterboxd et IMDb",
      "",
    );
  });
});
