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

  it("rejects test-send when SMTP isn't configured", async () => {
    const { controller, mail } = makeController();
    (mail.isConfigured as Mock).mockReturnValue(false);

    await expect(
      controller.sendTestEmail("welcome", { to: "a@b.com" }),
    ).rejects.toThrow(AppException);
    expect(mail.sendTemplateTest).not.toHaveBeenCalled();
  });

  it("throws NotFoundException test-sending an unknown template", async () => {
    const { controller, mail } = makeController();
    (mail.sendTemplateTest as Mock).mockResolvedValue(false);

    await expect(
      controller.sendTestEmail("nope", { to: "a@b.com" }),
    ).rejects.toThrow(AppException);
  });
});
