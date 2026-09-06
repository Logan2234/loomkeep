import { Prisma } from "@prisma/client";
import { vi, type Mock } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { NewsletterService } from "./newsletter.service";

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("NewsletterService.handleChangelogPublished", () => {
  function makeService(
    recipients: {
      id: string;
      email: string;
      locale: string;
      newsletterUnsubscribeToken: string | null;
    }[] = [
      {
        id: "user_1",
        email: "a@example.com",
        locale: "en",
        newsletterUnsubscribeToken: null,
      },
    ],
  ) {
    const prisma = {
      newsletterSend: {
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue(recipients),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
    } as unknown as PrismaService;
    const mail = { sendNewsletter: vi.fn() } as unknown as MailService;
    const service = new NewsletterService(prisma, mail);
    return { service, prisma, mail };
  }

  it("reserves the send, then sends and finalizes it, minting an unsubscribe token for a recipient who doesn't have one yet", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.newsletterSend.create as Mock).mockResolvedValue({
      id: "send_1",
    });

    await service.handleChangelogPublished(
      "changelog_1",
      "Loomkeep 1.3.0",
      "content",
      "<p>content</p>",
    );
    // The send itself is fired without awaiting (see NewsletterService docs).
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.newsletterSend.create).toHaveBeenCalledWith({
      data: { quackbackChangelogId: "changelog_1", title: "Loomkeep 1.3.0" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { newsletterUnsubscribeToken: expect.any(String) },
    });
    expect(mail.sendNewsletter).toHaveBeenCalledWith(
      { email: "a@example.com", locale: "en" },
      "Loomkeep 1.3.0",
      "content",
      "<p>content</p>",
      expect.any(String),
    );
    expect(prisma.newsletterSend.update).toHaveBeenCalledWith({
      where: { id: "send_1" },
      data: { recipientCount: 1 },
    });
  });

  it("reuses an existing unsubscribe token instead of minting a new one", async () => {
    const { service, prisma, mail } = makeService([
      {
        id: "user_1",
        email: "a@example.com",
        locale: "en",
        newsletterUnsubscribeToken: "existing-token",
      },
    ]);
    (prisma.newsletterSend.create as Mock).mockResolvedValue({
      id: "send_1",
    });

    await service.handleChangelogPublished(
      "changelog_1",
      "Loomkeep 1.3.0",
      "content",
      "<p>content</p>",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mail.sendNewsletter).toHaveBeenCalledWith(
      { email: "a@example.com", locale: "en" },
      "Loomkeep 1.3.0",
      "content",
      "<p>content</p>",
      "existing-token",
    );
  });

  it("loads the complete changelog when Quackback only sends its preview", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.newsletterSend.create as Mock).mockResolvedValue({
      id: "send_1",
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { content: "## :sparkles: New\n\n- The complete release note" },
      }),
    });
    const previousApiKey = process.env.QUACKBACK_API_KEY;
    process.env.QUACKBACK_API_KEY = "quackback-api-key";
    vi.stubGlobal("fetch", fetch);

    try {
      await service.handleChangelogPublished(
        "changelog_1",
        "Loomkeep 1.8.0",
        "Only the preview",
        "",
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(fetch).toHaveBeenCalledWith(
        "https://feedback.loomkeep.app/api/v1/changelog/changelog_1",
        { headers: { Authorization: "Bearer quackback-api-key" } },
      );
      expect(mail.sendNewsletter).toHaveBeenCalledWith(
        { email: "a@example.com", locale: "en" },
        "Loomkeep 1.8.0",
        "## :sparkles: New\n\n- The complete release note",
        "",
        expect.any(String),
      );
    } finally {
      vi.unstubAllGlobals();
      if (previousApiKey === undefined) {
        delete process.env.QUACKBACK_API_KEY;
      } else {
        process.env.QUACKBACK_API_KEY = previousApiKey;
      }
    }
  });

  it("is a no-op when the changelog entry was already reserved (retried webhook delivery)", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.newsletterSend.create as Mock).mockRejectedValue(
      uniqueConstraintError(),
    );

    await service.handleChangelogPublished(
      "changelog_1",
      "Loomkeep 1.3.0",
      "content",
      "<p>content</p>",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(mail.sendNewsletter).not.toHaveBeenCalled();
    expect(prisma.newsletterSend.update).not.toHaveBeenCalled();
  });

  it("propagates unexpected errors from the reserve step", async () => {
    const { service, prisma } = makeService();
    (prisma.newsletterSend.create as Mock).mockRejectedValue(
      new Error("db down"),
    );

    await expect(
      service.handleChangelogPublished(
        "changelog_1",
        "Loomkeep 1.3.0",
        "content",
        "<p>content</p>",
      ),
    ).rejects.toThrow("db down");
  });
});

describe("NewsletterService.unsubscribe", () => {
  function makeService() {
    const prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const mail = {} as unknown as MailService;
    const service = new NewsletterService(prisma, mail);
    return { service, prisma };
  }

  it("flips notifyNewsletter off for the user matching the token", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue({
      id: "user_1",
    });

    await service.unsubscribe("stable-token");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { newsletterUnsubscribeToken: "stable-token" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { notifyNewsletter: false },
    });
  });

  it("rejects an unknown token", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(service.unsubscribe("bogus")).rejects.toThrow(
      "Invalid unsubscribe link",
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
