import * as Sentry from "@sentry/node";
import { vi } from "vitest";
import type { QuotaTrackerService } from "../common/quota-tracker.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { QuotaAlertService } from "./quota-alert.service";

vi.mock("@sentry/node", () => ({ captureMessage: vi.fn() }));

function make() {
  const quota = { onThresholdReached: vi.fn() };
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([
        { email: "a@example.test", locale: "fr" },
        { email: "b@example.test", locale: "en" },
      ]),
    },
  };
  const mail = { sendQuotaAlert: vi.fn().mockResolvedValue(undefined) };
  const service = new QuotaAlertService(
    quota as unknown as QuotaTrackerService,
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
  );
  return { service, quota, prisma, mail };
}

describe("QuotaAlertService", () => {
  beforeEach(() => vi.mocked(Sentry.captureMessage).mockClear());

  it("listens to the quota tracker from startup", () => {
    const { service, quota } = make();
    service.onModuleInit();
    expect(quota.onThresholdReached).toHaveBeenCalledTimes(1);
  });

  it("emails every admin and reports to GlitchTip", async () => {
    const { service, mail } = make();

    await service.alert({
      provider: "omdb",
      count: 800,
      limit: 1000,
      threshold: 0.8,
    });

    expect(mail.sendQuotaAlert).toHaveBeenCalledTimes(2);
    expect(mail.sendQuotaAlert).toHaveBeenCalledWith(
      { email: "a@example.test", locale: "fr" },
      { provider: "OMDb", count: 800, limit: 1000, threshold: 0.8 },
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Provider quota: OMDb at 80% (800/1000 today)",
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("reports a spent quota as an error", async () => {
    const { service } = make();
    await service.alert({
      provider: "steam",
      count: 100_000,
      limit: 100_000,
      threshold: 1,
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ level: "error" }),
    );
  });

  it("leaves a spent SMTP quota to GlitchTip, since the email couldn't go out", async () => {
    const { service, mail } = make();

    await service.alert({
      provider: "smtp",
      count: 300,
      limit: 300,
      threshold: 1,
    });

    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(mail.sendQuotaAlert).not.toHaveBeenCalled();
  });
});
