import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
import type { MailService } from "../mail/mail.service";
import { AdminEmailsController } from "./admin-emails.controller";

function makeController() {
  const mail = {
    listTemplates: vi
      .fn()
      .mockReturnValue([{ key: "welcome", label: "Bienvenue" }]),
    isConfigured: vi.fn().mockReturnValue(true),
    renderTemplatePreview: vi.fn(),
    sendTemplateTest: vi.fn(),
  } as unknown as MailService;

  const controller = new AdminEmailsController(mail);
  return { controller, mail };
}

describe("AdminEmailsController", () => {
  it("lists templates alongside SMTP configuration state", () => {
    const { controller } = makeController();
    const result = controller.listEmailTemplates();
    expect(result).toEqual({
      templates: [{ key: "welcome", label: "Bienvenue" }],
      smtpConfigured: true,
    });
  });

  it("throws NotFoundException previewing an unknown template", () => {
    const { controller, mail } = makeController();
    (mail.renderTemplatePreview as Mock).mockReturnValue(null);

    expect(() => controller.previewEmailTemplate("nope", {})).toThrow(
      AppException,
    );
  });

  it("passes the selected locale separately from template overrides", () => {
    const { controller, mail } = makeController();
    (mail.renderTemplatePreview as Mock).mockReturnValue({
      subject: "Welcome",
      html: "<html></html>",
      text: "Welcome",
    });

    controller.previewEmailTemplate("welcome", {
      locale: "en",
      displayName: "Alice",
    });

    expect(mail.renderTemplatePreview).toHaveBeenCalledWith("welcome", "en", {
      displayName: "Alice",
    });
  });

  it("rejects test-send when SMTP isn't configured", async () => {
    const { controller, mail } = makeController();
    (mail.isConfigured as Mock).mockReturnValue(false);

    await expect(
      controller.sendTestEmail("welcome", { to: "a@b.com", locale: "fr" }),
    ).rejects.toThrow(AppException);
    expect(mail.sendTemplateTest).not.toHaveBeenCalled();
  });

  it("throws NotFoundException test-sending an unknown template", async () => {
    const { controller, mail } = makeController();
    (mail.sendTemplateTest as Mock).mockResolvedValue(false);

    await expect(
      controller.sendTestEmail("nope", { to: "a@b.com", locale: "fr" }),
    ).rejects.toThrow(AppException);
  });

  it("sends the test email in the selected locale", async () => {
    const { controller, mail } = makeController();
    (mail.sendTemplateTest as Mock).mockResolvedValue(true);

    await controller.sendTestEmail("welcome", {
      to: "a@b.com",
      locale: "en",
      values: { displayName: "Alice" },
    });

    expect(mail.sendTemplateTest).toHaveBeenCalledWith(
      "welcome",
      { email: "a@b.com", locale: "en" },
      { displayName: "Alice" },
    );
  });
});
