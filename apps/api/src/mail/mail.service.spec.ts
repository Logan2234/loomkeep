import { ALERTS, type AlertDefinition } from "@loomkeep/shared";
import nodemailer from "nodemailer";
import { vi, type Mock } from "vitest";
import type { QuotaTrackerService } from "../common/quota-tracker.service";
import { MAIL_COPY } from "./mail.i18n";
import { MailService } from "./mail.service";

vi.mock("nodemailer");

const quota = { record: vi.fn() } as unknown as QuotaTrackerService;

describe("MailService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MAIL_SUPPORT_ADDRESS;
    delete process.env.PUBLIC_API_URL;
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

  it.each(["fr", "en", "it"] as const)(
    "provides a safe localized preheader for every template in %s",
    (locale) => {
      const service = new MailService(quota);

      for (const { key } of service.listTemplates()) {
        const preview = service.renderTemplatePreview(key, locale, {
          code: "secret-code",
          token: "secret-token",
          content: "private-content",
        })!;
        const preheader = preview.html.match(
          /class="email-preheader"[^>]*>([^<]+)<\/div>/,
        )?.[1];
        expect(preheader, key).toBe(
          MAIL_COPY[locale].preheaders[
            key as keyof typeof MAIL_COPY.fr.preheaders
          ],
        );
        expect(preheader, key).toBeTruthy();
        expect(preheader, key).not.toMatch(
          /secret-code|secret-token|private-content/,
        );
        expect(preview.html).toContain("mso-hide:all");
      }
    },
  );

  it.each(["fr", "en", "it"] as const)(
    "renders the supplied security event date with an explicit UTC time in %s",
    (locale) => {
      const service = new MailService(quota);
      const occurredAt = "2024-05-12T10:15:00Z";
      const date = new Intl.DateTimeFormat(
        { fr: "fr-FR", en: "en-US", it: "it-IT" }[locale],
        { dateStyle: "long", timeStyle: "long", timeZone: "UTC" },
      ).format(new Date(occurredAt));

      for (const key of [
        "passwordChanged",
        "emailChangedOld",
        "emailChangedNew",
        "newDeviceLogin",
        "apiKeyCreated",
        "apiKeyLeaked",
        "securityAlert",
      ]) {
        const preview = service.renderTemplatePreview(key, locale, {
          occurredAt,
        })!;
        expect(preview.text, key).toContain(
          MAIL_COPY[locale].layout.eventAt(date),
        );
        expect(preview.html, key).toContain("2024");
        expect(preview.text, key).toMatch(/UTC/);
      }
    },
  );

  it("uses the configured support mailbox in contacts and Reply-To, with a moderation reference", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.MAIL_SUPPORT_ADDRESS = "support@instance.example";
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as never);
    const service = new MailService(quota);

    for (const key of [
      "welcome",
      "emailChangedOld",
      "emailChangedNew",
      "moderationDecision",
    ]) {
      await service.sendTemplateTest(
        key,
        { email: "recipient@example.com", locale: "fr" },
        { decisionId: "decision-42", decidedAt: "2024-05-12T10:15:00Z" },
      );
    }

    for (const [mail] of sendMail.mock.calls) {
      expect(mail.replyTo).toBe("support@instance.example");
      expect(mail.html).toContain("mailto:support@instance.example");
      expect(mail.html).not.toContain("contact@loomkeep.app");
    }

    const moderation = sendMail.mock.calls.at(-1)![0];
    expect(moderation.text).toContain("decision-42");
    expect(moderation.text).toContain("2024");
    expect(moderation.html).toContain("Contacter la modération");
    expect(moderation.html).toMatch(
      /mailto:support@instance.example\?subject=[^"]*decision-42/,
    );
    expect(moderation.subject).not.toContain("[Admin]");
  });

  it("sends RFC 8058 headers only for newsletters, pointing directly at the HTTPS API", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.PUBLIC_API_URL = "https://api.instance.example/api/";
    process.env.UMAMI_LINKS_BASE_URL = "https://tracking.example";
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as never);
    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "recipient@example.com", locale: "fr" },
      "Title",
      "Content",
      "",
      "a&b=+/",
    );
    expect(sendMail.mock.calls[0][0].headers).toEqual({
      "List-Unsubscribe":
        "<https://api.instance.example/api/newsletter/unsubscribe/one-click?token=a%26b%3D%2B%2F>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    for (const { key } of service
      .listTemplates()
      .filter(({ key }) => key !== "newsletter")) {
      await service.sendTemplateTest(key, {
        email: "recipient@example.com",
        locale: "en",
      });
    }

    expect(
      sendMail.mock.calls
        .slice(1)
        .every(([mail]) => mail.headers === undefined),
    ).toBe(true);
  });

  it("keeps the newsletter footer without one-click headers on an HTTP API", () => {
    process.env.PUBLIC_API_URL = "http://localhost:3000/api";
    const preview = new MailService(quota).renderTemplatePreview("newsletter")!;
    expect(preview.headers).toBeUndefined();
    expect(preview.html).toContain("/unsubscribe?token=");
  });

  it.each(["fr", "en", "it"])(
    "describes scheduled inactivity deletion without claiming it is imminent in %s",
    (locale) => {
      const preview = new MailService(quota).renderTemplatePreview(
        "inactivityWarning",
        locale,
        { deletionDate: "2027-10-03" },
      )!;
      expect(preview.html).not.toMatch(/bientôt|soon|presto/i);
      expect(preview.text).toContain("2027");
      expect(preview.text).toContain("24");
    },
  );

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
    expect(html).toContain("https://loomkeep.example/app/settings/security");
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
      "https://loomkeep.example/app/settings/communications",
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

  it("removes unsafe URLs from Quackback HTML and Markdown links", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.8.0",
      "content",
      '<a href="&#x6a;avascript:alert(1)">Unsafe</a><img src="data:image/svg+xml;base64,test"><a href="https://loomkeep.app">Safe</a>',
      "unsub-token-123",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:image");
    expect(html).toContain('href="https://loomkeep.app"');

    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.8.0",
      "[Unsafe](javascript:alert(1)) and [safe](https://loomkeep.app)",
      "",
      "unsub-token-123",
    );

    const fallbackHtml = sendMail.mock.calls[1][0].html;
    expect(fallbackHtml).not.toContain("javascript:");
    expect(fallbackHtml).toContain('href="https://loomkeep.app"');
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

  it("renders common Quackback emoji aliases in a Markdown fallback", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "fr" },
      "Loomkeep 1.8.0",
      "## :sparkles: New\n\n- :wrench: Improved\n\n## :bug: Fixes",
      "",
      "unsub-token-123",
    );

    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain("✨ New");
    expect(html).toContain("🔧 Improved");
    expect(html).toContain("🐛 Fixes");
    expect(html).not.toContain(":sparkles:");
  });

  it("renders the new changelog section emoji aliases in HTML and plain text", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";

    const sendMail = vi.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as Mock).mockReturnValue({ sendMail });

    const service = new MailService(quota);
    await service.sendNewsletter(
      { email: "alice@example.com", locale: "en" },
      "Loomkeep",
      "## :electric_plug: API and integrations\n\n## :books: Documentation\n\n## :house: Self-hosting and administration",
      "",
      "unsub-token-123",
    );

    const { html, text } = sendMail.mock.calls[0][0];

    for (const content of [html, text]) {
      expect(content).toContain("🔌 API and integrations");
      expect(content).toContain("📚 Documentation");
      expect(content).toContain("🏠 Self-hosting and administration");
      expect(content).not.toMatch(/:(electric_plug|books|house):/);
    }
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
        "apiKeyCreated",
      ]),
    );
  });

  it("has every template listed in the alerts registry", () => {
    const service = new MailService(quota);
    const registered = Object.values(ALERTS).map(
      (alert: AlertDefinition) => alert.mailTemplate,
    );

    for (const { key } of service.listTemplates()) {
      expect(registered, key).toContain(key);
    }
  });

  it("tells a locked second factor apart: the password is known", () => {
    const service = new MailService(quota);

    const locked = service.renderTemplatePreview("securityAlert", "en", {
      event: "MFA_CHALLENGE_LOCKED",
    });
    const disabled = service.renderTemplatePreview("securityAlert", "en", {
      event: "MFA_TOTP_DISABLED",
    });

    expect(locked?.text).toContain("probably knows your password");
    expect(disabled?.text).toContain("was turned off");
    expect(disabled?.text).not.toContain("probably knows your password");
  });

  it("renders a preview without sending anything", async () => {
    delete process.env.SMTP_HOST;
    const service = new MailService(quota);

    const preview = service.renderTemplatePreview("welcome");

    expect(preview).not.toBeNull();
    expect(preview?.subject).toContain("Bienvenue");
    expect(preview?.html).toContain("Loomkeep");
  });

  it("links to the first web origin when WEB_ORIGIN lists several", () => {
    process.env.WEB_ORIGIN = "http://localhost:5173,https://dev.loomkeep.app";
    const service = new MailService(quota);

    const preview = service.renderTemplatePreview("apiKeyCreated");

    expect(preview?.html).toContain(
      'href="http://localhost:5173/app/settings/integrations"',
    );
    expect(preview?.text).not.toContain(",https://");
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

  it("shows an escaped job error only in the failure alert", () => {
    const service = new MailService(quota);

    const failed = service.renderTemplatePreview("jobAlert", "fr", {
      jobKey: "backup.run",
      error: "<script>boom</script>",
    });
    const recovered = service.renderTemplatePreview("jobAlert", "fr", {
      jobKey: "backup.run",
      status: "SUCCESS",
    });

    expect(failed?.subject).toBe("[Admin] Échec du job backup.run");
    expect(failed?.html).toContain("&lt;script&gt;boom&lt;/script&gt;");
    expect(recovered?.subject).toBe("[Admin] Job backup.run rétabli");
    expect(recovered?.text).not.toContain("boom");
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

  it("names a removed review in the moderation notice", () => {
    const service = new MailService(quota);
    const preview = service.renderTemplatePreview("moderationDecision", "en", {
      measure: "REVIEW_REMOVED",
    });

    expect(preview?.subject).toBe("One of your reviews has been removed");
  });

  it("names every measure of a combined profile decision, with the suspension end", () => {
    const service = new MailService(quota);
    const preview = service.renderTemplatePreview("moderationDecision", "en", {
      measure: "AVATAR_REMOVED,BIO_CLEARED,ACCOUNT_SUSPENDED",
      suspendedUntil: "2026-10-10T14:20:00Z",
    });

    expect(preview?.subject).toBe(
      "Measures have been taken on your Loomkeep account",
    );
    expect(preview?.text).toContain(
      "the removal of your profile picture, the removal of your bio and the suspension of your account until",
    );
    expect(preview?.text).toContain("2026");
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

  it.each(["fr", "en", "it"])(
    "keeps admin subjects and links distinct in %s",
    (locale) => {
      process.env.WEB_ORIGIN = "https://loomkeep.example";
      process.env.UMAMI_LINKS_BASE_URL = "https://stats.example/q";
      const service = new MailService(quota);

      for (const key of [
        "quotaAlert",
        "jobAlert",
        "reportsDigest",
        "adminNewUser",
      ]) {
        const preview = service.renderTemplatePreview(key, locale)!;
        expect(preview.subject, key).toMatch(/^\[Admin\] /);
        expect(preview.html, key).toContain('href="https://loomkeep.example"');
        expect(preview.html, key).toContain(
          'href="https://loomkeep.example/app/admin"',
        );
        expect(preview.html, key).not.toContain("https://stats.example");
        expect(preview.text, key).not.toContain("https://stats.example");
      }

      expect(
        service.renderTemplatePreview("moderationDecision", locale)?.subject,
      ).not.toMatch(/^\[Admin\]/);
    },
  );

  it.each([
    ["apiKeyCreated", "secu-api-creee"],
    ["apiKeyExpiring", "secu-api-expiration"],
    ["apiKeyLeaked", "secu-api-fuite"],
    ["securityAlert", "secu-alerte"],
    ["inactivityWarning", "compte-inactivite"],
  ])("tracks user actions in %s", (key, slug) => {
    process.env.UMAMI_LINKS_BASE_URL = "https://stats.example/q";
    const preview = new MailService(quota).renderTemplatePreview(key)!;
    expect(preview.html).toContain(`href="https://stats.example/q/${slug}"`);
    expect(preview.text).toContain(`https://stats.example/q/${slug}`);
    expect(preview.html).toContain(
      'href="https://stats.example/q/header-site"',
    );
    expect(preview.html).toContain(
      'href="https://stats.example/q/footer-site"',
    );
  });

  it("places communication controls once in the relevant footer", () => {
    process.env.WEB_ORIGIN = "https://loomkeep.example";
    delete process.env.UMAMI_LINKS_BASE_URL;
    const service = new MailService(quota);
    const newsletter = service.renderTemplatePreview("newsletter")!.html;
    const digest = service.renderTemplatePreview("episodeDigest")!.html;
    const classic = service.renderTemplatePreview("welcome")!.html;
    const footer = (html: string) =>
      html.slice(html.indexOf('class="email-footer"'));
    expect(footer(newsletter)).toContain("/unsubscribe?token=preview-token");
    expect(footer(newsletter)).toContain("/app/settings/communications");
    expect(
      newsletter.match(/href="[^"]*\/app\/settings\/communications"/g),
    ).toHaveLength(1);
    expect(footer(digest)).toContain("/app/settings/communications");
    expect(digest).not.toContain("/unsubscribe");
    expect(classic).not.toContain("/unsubscribe");
    expect(footer(classic)).toContain("mailto:contact@loomkeep.app");
  });

  it.each(["passwordResetLink", "verifyEmail", "invitation"])(
    "offers a direct fallback link for %s",
    (key) => {
      process.env.WEB_ORIGIN = "https://loomkeep.example";
      process.env.UMAMI_LINKS_BASE_URL = "https://stats.example/q";
      const preview = new MailService(quota).renderTemplatePreview(key, "en")!;
      expect(preview.html).toContain("If the button does not work");
      const tokenLinks = preview.html.match(
        /href="[^"]*(?:token|invite)=[^"]*"/g,
      )!;
      expect(tokenLinks).toHaveLength(2);
      expect(tokenLinks.every((link) => !link.includes("stats.example"))).toBe(
        true,
      );
    },
  );

  it.each(["passwordResetLink", "verifyEmail"])(
    "preserves the token in both links for %s",
    (key) => {
      process.env.WEB_ORIGIN = "https://loomkeep.example";
      const preview = new MailService(quota).renderTemplatePreview(key, "fr", {
        token: "a&b=+/<test>",
      })!;
      expect(
        preview.html.match(/token=a%26b%3D%2B%2F%3Ctest%3E/g),
      ).toHaveLength(3);
      expect(preview.text).toContain("token=a%26b%3D%2B%2F%3Ctest%3E");
    },
  );

  it.each(["fr", "en", "it"])(
    "renders the shared layout for every template in %s",
    (locale) => {
      const service = new MailService(quota);

      for (const { key } of service.listTemplates()) {
        const html = service.renderTemplatePreview(key, locale)!.html;
        expect(html, key).toContain('class="email-header"');
        expect(html, key).toContain('class="email-footer"');
        expect(html, key).not.toContain("undefined");
      }
    },
  );

  it.each([
    ["fr", "Ne partage jamais ce code"],
    ["en", "Never share this code"],
    ["it", "Non condividere mai questo codice"],
  ])("includes code safety instructions in %s", (locale, instruction) => {
    const service = new MailService(quota);

    for (const key of ["emailChangeCode", "mfaEmailCode"]) {
      const preview = service.renderTemplatePreview(key, locale)!;
      expect(preview.html).toContain(instruction);
      expect(preview.text).toContain(instruction);
    }

    const changed = service.renderTemplatePreview("emailChangedNew", locale)!;
    expect(changed.text).toContain("mailto:contact@loomkeep.app");
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
