import nodemailer from "nodemailer";
import { vi, type Mock } from "vitest";
import type { QuotaTrackerService } from "../common/quota-tracker.service";
import { MailService } from "./mail.service";

vi.mock("nodemailer");

const quota = { record: vi.fn() } as unknown as QuotaTrackerService;

describe("MailService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
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
    await service.sendWelcome(
      { email: "alice@example.com", locale: "fr" },
      "Alice",
    );

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("sends through the configured transport when SMTP is set", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.SMTP_FROM = "Loomkeep <noreply@loomkeep.app>";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendPasswordResetLink(
      { email: "alice@example.com", locale: "fr" },
      "tok123",
    );

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

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendEmailChangeCode(
      { email: "alice@example.com", locale: "fr" },
      "123456",
    );

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

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewDeviceLogin(
      { email: "alice@example.com", locale: "fr" },
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

    const sendMail = vi.fn().mockRejectedValue(new Error("smtp down"));
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await expect(
      service.sendPasswordChanged({ email: "alice@example.com", locale: "fr" }),
    ).resolves.toBeUndefined();
  });

  it("links password-changed to the reset flow, not a settings page it may not be able to reach", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendPasswordChanged({
      email: "alice@example.com",
      locale: "fr",
    });

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("https://loomkeep.example/forgot-password");
  });

  it("links new-device-login to in-app security settings", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewDeviceLogin(
      { email: "alice@example.com", locale: "fr" },
      "Chrome",
      null,
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("https://loomkeep.example/app/settings#securite");
  });

  it("links email-changed (old address) to a mailto contact, not the app", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendEmailChanged("old@example.com", "new@example.com", "fr");

    const oldAddressCall = sendMail.mock.calls.find(
      (call) => call[0].to === "old@example.com",
    );
    expect(oldAddressCall![0].html).toContain("mailto:contact@loomkeep.app");
  });

  it("links welcome to the app", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendWelcome(
      { email: "alice@example.com", locale: "fr" },
      "Alice",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("https://loomkeep.example/app");
  });

  it("includes a no-login unsubscribe link in the newsletter, alongside the settings link", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.4.0",
      "content",
      "",
      "unsub-token-123",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain(
      "https://loomkeep.example/unsubscribe?token=unsub-token-123",
    );
    expect(html).toContain(
      "https://loomkeep.example/app/settings#communications",
    );
  });

  it("uses Quackback's full contentHtml instead of the truncated preview", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.7.0",
      "## New\n\n- Only the start of the changelog fits in a 200-char preview",
      "<h2>New</h2><p>The full body, including a section past the 200-char preview cutoff.</p>",
      "unsub-token-123",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("past the 200-char preview cutoff");
  });

  it("falls back to rendering the Markdown preview when contentHtml is empty", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.WEB_ORIGIN = "https://loomkeep.example";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.7.0",
      "## New\n\n- Rendered from Markdown",
      "",
      "unsub-token-123",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("Rendered from Markdown");
  });
});

describe("MailService template gallery", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders the same template in the requested locale", () => {
    const service = new MailService(quota);

    const french = service.renderTemplatePreview("welcome", "fr");
    const english = service.renderTemplatePreview("welcome", "en");

    expect(french?.subject).toBe("Bienvenue sur Loomkeep");
    expect(french?.html).toContain('<html lang="fr">');
    expect(english?.subject).toBe("Welcome to Loomkeep");
    expect(english?.html).toContain('<html lang="en">');
    expect(english?.text).toContain("Your Loomkeep account was created");
  });

  it("renders every gallery template in English", () => {
    const service = new MailService(quota);

    for (const template of service.listTemplates()) {
      const preview = service.renderTemplatePreview(template.key, "en");
      expect(preview, template.key).not.toBeNull();
      expect(preview?.html, template.key).toContain('<html lang="en">');
    }
  });

  it("keeps editorial moderation content as authored", () => {
    const service = new MailService(quota);
    const preview = service.renderTemplatePreview("moderationDecision", "en", {
      reasonText: "Texte libre rédigé par la modération.",
      tosClause: "Article 7 — Conduite",
    });

    expect(preview?.text).toContain("Texte libre rédigé par la modération.");
    expect(preview?.text).toContain("Article 7 — Conduite");
    expect(preview?.text).toContain("This decision was made by a moderator");
  });

  it("localizes dates but leaves newsletter copy as authored", () => {
    const service = new MailService(quota);
    const inactivity = service.renderTemplatePreview(
      "inactivityWarning",
      "en",
      {
        deletionDate: "2028-08-15",
      },
    );
    const newsletter = service.renderTemplatePreview("newsletter", "en", {
      title: "Version été",
      content: "Contenu éditorial inchangé.",
    });

    expect(inactivity?.text).toContain("August 15, 2028");
    expect(newsletter?.subject).toBe("Loomkeep — Version été");
    expect(newsletter?.text).toContain("Contenu éditorial inchangé.");
    expect(newsletter?.text).toContain("You are receiving this email");
  });

  it("returns null for an unknown template key", () => {
    const service = new MailService(quota);
    expect(service.renderTemplatePreview("does-not-exist")).toBeNull();
  });

  it("sends a rendered template to the given address", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    const sent = await service.sendTemplateTest("welcome", {
      email: "test@example.com",
      locale: "fr",
    });

    expect(sent).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" }),
    );
  });

  it("returns false when sending an unknown template key", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    (nodemailer.createTransport as Mock).mockReturnValue({
      sendMail: vi.fn(),
    });

    const service = new MailService(quota);
    const sent = await service.sendTemplateTest("does-not-exist", {
      email: "test@example.com",
      locale: "fr",
    });

    expect(sent).toBe(false);
  });
});
