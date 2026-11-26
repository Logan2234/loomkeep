import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import type { TurnstileService } from "../auth/turnstile.service";
import type { MailService } from "../mail/mail.service";
import { ContactService } from "./contact.service";

function makeService({ receives = true, human = true, sent = true } = {}) {
  const mail = {
    canReceiveContact: vi.fn(() => receives),
    sendAccessibilityReport: vi.fn().mockResolvedValue(sent),
  };
  const turnstile = { verify: vi.fn().mockResolvedValue(human) };
  return {
    service: new ContactService(
      mail as unknown as MailService,
      turnstile as unknown as TurnstileService,
    ),
    mail,
  };
}

const report = {
  message: "  The search's add button has no name for TalkBack.  ",
  page: " /app/search ",
  email: "",
  locale: "en" as const,
};

describe("ContactService.reportAccessibility", () => {
  it("forwards a trimmed report in the visitor's language", async () => {
    const { service, mail } = makeService();

    await service.reportAccessibility(report, "203.0.113.4");

    expect(mail.sendAccessibilityReport).toHaveBeenCalledWith(
      {
        message: "The search's add button has no name for TalkBack.",
        page: "/app/search",
        email: undefined,
      },
      "en",
    );
  });

  it("drops a report whose hidden field was filled, without telling the bot", async () => {
    const { service, mail } = makeService();

    await expect(
      service.reportAccessibility({ ...report, website: "https://spam" }),
    ).resolves.toBeUndefined();
    expect(mail.sendAccessibilityReport).not.toHaveBeenCalled();
  });

  it.each([
    [{ receives: false }, ErrorCode.ContactUnavailable],
    [{ human: false }, ErrorCode.AuthAntiBotVerificationFailed],
    [{ sent: false }, ErrorCode.ContactSendFailed],
  ])("refuses with a typed code (%o)", async (options, code) => {
    const { service } = makeService(options);

    await expect(service.reportAccessibility(report)).rejects.toMatchObject({
      code,
    });
  });
});
