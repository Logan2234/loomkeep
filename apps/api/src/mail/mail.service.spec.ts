import nodemailer from "nodemailer";
import type { QuotaTrackerService } from "../common/quota-tracker.service";
import { MailService } from "./mail.service";

jest.mock("nodemailer");

const quota = { record: jest.fn() } as unknown as QuotaTrackerService;

describe("MailService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("is a no-op when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const service = new MailService(quota);
    await service.sendWelcome("alice@example.com", "Alice");

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("sends through the configured transport when SMTP is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.SMTP_FROM = "Loomkeep <noreply@loomkeep.app>";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendPasswordResetLink("alice@example.com", "tok123");

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "user", pass: "pass" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Loomkeep <noreply@loomkeep.app>",
        to: "alice@example.com",
        text: expect.stringContaining(
          "https://loomkeep.example/reset-password?token=tok123",
        ),
      }),
    );
  });

  it("wraps the confirmation code in the shared HTML layout", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendEmailChangeCode("alice@example.com", "123456");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        text: expect.stringContaining("123456"),
        html: expect.stringContaining("123456"),
      }),
    );
    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("Loomkeep");
    expect(html).toContain("Confirme ton adresse email");
  });

  it("escapes the device label and IP in the new-device alert", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewDeviceLogin(
      "alice@example.com",
      "<script>alert(1)</script>",
      "1.2.3.4",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("1.2.3.4");
  });

  it("swallows send failures instead of throwing", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = jest.fn().mockRejectedValue(new Error("smtp down"));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await expect(
      service.sendPasswordChanged("alice@example.com"),
    ).resolves.toBeUndefined();
  });
});

describe("MailService template gallery", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("lists every known template key", () => {
    const service = new MailService(quota);
    const keys = service.listTemplates().map((t) => t.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "welcome",
        "verifyEmail",
        "passwordResetLink",
        "passwordChanged",
        "emailChangedOld",
        "emailChangedNew",
        "emailChangeCode",
        "newEpisode",
        "newDeviceLogin",
      ]),
    );
  });

  it("renders a preview without sending anything", async () => {
    delete process.env.SMTP_HOST;
    const service = new MailService(quota);

    const preview = service.renderTemplatePreview("welcome");

    expect(preview).not.toBeNull();
    expect(preview?.subject).toContain("Bienvenue");
    expect(preview?.html).toContain("Loomkeep");
  });

  it("returns null for an unknown template key", () => {
    const service = new MailService(quota);
    expect(service.renderTemplatePreview("does-not-exist")).toBeNull();
  });

  it("sends a rendered template to the given address", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    const sent = await service.sendTemplateTest("welcome", "test@example.com");

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" }),
    );
  });

  it("returns false when sending an unknown template key", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn(),
    });

    const service = new MailService(quota);
    const sent = await service.sendTemplateTest(
      "does-not-exist",
      "test@example.com",
    );

    expect(sent).toBe(false);
  });
});
