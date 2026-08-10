import { Prisma } from "@prisma/client";
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
  function makeService() {
    const prisma = {
      newsletterSend: {
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ email: "a@example.com" }]),
      },
    } as unknown as PrismaService;
    const mail = { sendNewsletter: jest.fn() } as unknown as MailService;
    const service = new NewsletterService(prisma, mail);
    return { service, prisma, mail };
  }

  it("reserves the send, then sends and finalizes it", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.newsletterSend.create as jest.Mock).mockResolvedValue({
      id: "send_1",
    });

    await service.handleChangelogPublished(
      "changelog_1",
      "Loomkeep 1.3.0",
      "content",
    );
    // The send itself is fired without awaiting (see NewsletterService docs).
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.newsletterSend.create).toHaveBeenCalledWith({
      data: { quackbackChangelogId: "changelog_1", title: "Loomkeep 1.3.0" },
    });
    expect(mail.sendNewsletter).toHaveBeenCalledWith(
      "a@example.com",
      "Loomkeep 1.3.0",
      "content",
    );
    expect(prisma.newsletterSend.update).toHaveBeenCalledWith({
      where: { id: "send_1" },
      data: { recipientCount: 1 },
    });
  });

  it("is a no-op when the changelog entry was already reserved (retried webhook delivery)", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.newsletterSend.create as jest.Mock).mockRejectedValue(
      uniqueConstraintError(),
    );

    await service.handleChangelogPublished(
      "changelog_1",
      "Loomkeep 1.3.0",
      "content",
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(mail.sendNewsletter).not.toHaveBeenCalled();
    expect(prisma.newsletterSend.update).not.toHaveBeenCalled();
  });

  it("propagates unexpected errors from the reserve step", async () => {
    const { service, prisma } = makeService();
    (prisma.newsletterSend.create as jest.Mock).mockRejectedValue(
      new Error("db down"),
    );

    await expect(
      service.handleChangelogPublished(
        "changelog_1",
        "Loomkeep 1.3.0",
        "content",
      ),
    ).rejects.toThrow("db down");
  });
});
