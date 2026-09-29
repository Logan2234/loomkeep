import * as Sentry from "@sentry/node";
import { vi } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { JobAlertService } from "./job-alert.service";
import { JOB_KEYS } from "./job-keys";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

function make() {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue([
        { email: "a@example.test", locale: "fr" },
        { email: "b@example.test", locale: "en" },
      ]),
    },
  };
  const mail = { sendJobAlert: vi.fn().mockResolvedValue(undefined) };
  const service = new JobAlertService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
  );
  return { service, prisma, mail };
}

describe("JobAlertService", () => {
  beforeEach(() => vi.mocked(Sentry.captureException).mockClear());

  it("emails every admin the error's first line and reports it to GlitchTip", async () => {
    const { service, mail } = make();
    const error = new Error("dump failed\nstderr: details");

    await service.jobFailed(JOB_KEYS.BACKUP, error);

    expect(mail.sendJobAlert).toHaveBeenCalledTimes(2);
    expect(mail.sendJobAlert).toHaveBeenCalledWith(
      { email: "a@example.test", locale: "fr" },
      { jobKey: JOB_KEYS.BACKUP, error: "dump failed" },
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { jobKey: JOB_KEYS.BACKUP },
    });
  });

  it("emails every admin once the job recovers, without a GlitchTip event", async () => {
    const { service, mail } = make();

    await service.jobRecovered(JOB_KEYS.BACKUP);

    expect(mail.sendJobAlert).toHaveBeenCalledWith(
      { email: "b@example.test", locale: "en" },
      { jobKey: JOB_KEYS.BACKUP, error: null },
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("swallows a mail failure so the job's own outcome is untouched", async () => {
    const { service, mail } = make();
    mail.sendJobAlert.mockRejectedValue(new Error("SMTP down"));

    await expect(
      service.jobFailed(JOB_KEYS.BACKUP, new Error("boom")),
    ).resolves.toBeUndefined();
  });
});
