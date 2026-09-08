import { vi } from "vitest";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { UsersController } from "./users.controller";
import type { UsersService } from "./users.service";

// The controller is a pure HTTP adapter over UsersService — business-logic
// coverage (email change, password rules, avatar validation, deletion
// summary, etc.) lives in users.service.spec.ts. This only checks that each
// route delegates to the right service method with the right arguments.
function jwtPayload(sub: string): JwtPayload {
  return { sub, email: `${sub}@example.com` };
}

function makeController() {
  const users = {
    getMe: vi.fn(),
    getMyProfile: vi.fn(),
    getWidgetToken: vi.fn(),
    getAvatar: vi.fn().mockResolvedValue({
      avatar: Buffer.from("img"),
      avatarMimeType: "image/png",
    }),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    exportData: vi.fn(),
    exportCsv: vi.fn(),
    getCalendarToken: vi.fn(),
    regenerateCalendarToken: vi.fn(),
    getMyEntitlement: vi.fn(),
    completeOnboarding: vi.fn(),
    acceptTerms: vi.fn(),
    updateMe: vi.fn(),
    changeEmail: vi.fn(),
    confirmEmailChange: vi.fn(),
    changePassword: vi.fn(),
    deletionSummary: vi.fn(),
    deleteAccount: vi.fn(),
    checkUsernameAvailability: vi.fn(),
    updateUsername: vi.fn(),
  } as unknown as UsersService;
  return { controller: new UsersController(users), users };
}

function fakeReply() {
  const reply = {
    header: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as import("fastify").FastifyReply;
}

describe("UsersController — delegation to UsersService", () => {
  const userId = "user-1";
  const payload = jwtPayload(userId);

  it("getMe", () => {
    const { controller, users } = makeController();
    void controller.getMe(payload);
    expect(users.getMe).toHaveBeenCalledWith(userId);
  });

  it("getMyProfile", () => {
    const { controller, users } = makeController();
    void controller.getMyProfile(payload);
    expect(users.getMyProfile).toHaveBeenCalledWith(userId);
  });

  it("getWidgetToken", () => {
    const { controller, users } = makeController();
    void controller.getWidgetToken(payload);
    expect(users.getWidgetToken).toHaveBeenCalledWith(userId, payload.email);
  });

  it("getAvatar streams the resolved buffer with the public-image headers", async () => {
    const { controller, users } = makeController();
    const reply = fakeReply();

    await controller.getAvatar("target-id", reply);

    expect(users.getAvatar).toHaveBeenCalledWith("target-id");
    expect(reply.type).toHaveBeenCalledWith("image/png");
    expect(reply.send).toHaveBeenCalledWith(Buffer.from("img"));
  });

  it("uploadAvatar", () => {
    const { controller, users } = makeController();
    const dto = { mimeType: "image/png", data: "abc" } as const;
    void controller.uploadAvatar(payload, dto);
    expect(users.uploadAvatar).toHaveBeenCalledWith(userId, dto);
  });

  it("deleteAvatar", () => {
    const { controller, users } = makeController();
    void controller.deleteAvatar(payload);
    expect(users.deleteAvatar).toHaveBeenCalledWith(userId);
  });

  it("exportData", () => {
    const { controller, users } = makeController();
    void controller.exportData(payload);
    expect(users.exportData).toHaveBeenCalledWith(userId);
  });

  it("exportCsv", () => {
    const { controller, users } = makeController();
    void controller.exportCsv(payload, "MEDIA");
    expect(users.exportCsv).toHaveBeenCalledWith(userId, "MEDIA");
  });

  it("getCalendarToken", () => {
    const { controller, users } = makeController();
    void controller.getCalendarToken(payload);
    expect(users.getCalendarToken).toHaveBeenCalledWith(userId);
  });

  it("regenerateCalendarToken", () => {
    const { controller, users } = makeController();
    void controller.regenerateCalendarToken(payload);
    expect(users.regenerateCalendarToken).toHaveBeenCalledWith(userId);
  });

  it("getMyEntitlement", () => {
    const { controller, users } = makeController();
    void controller.getMyEntitlement(payload);
    expect(users.getMyEntitlement).toHaveBeenCalledWith(userId);
  });

  it("completeOnboarding", () => {
    const { controller, users } = makeController();
    void controller.completeOnboarding(payload);
    expect(users.completeOnboarding).toHaveBeenCalledWith(userId);
  });

  it("acceptTerms", () => {
    const { controller, users } = makeController();
    void controller.acceptTerms(payload);
    expect(users.acceptTerms).toHaveBeenCalledWith(userId);
  });

  it("updateMe", () => {
    const { controller, users } = makeController();
    const dto = { displayName: "Alice" };
    void controller.updateMe(payload, dto);
    expect(users.updateMe).toHaveBeenCalledWith(userId, dto);
  });

  it("changeEmail", () => {
    const { controller, users } = makeController();
    const dto = { newEmail: "new@example.com", currentPassword: "pw" };
    void controller.changeEmail(payload, dto);
    expect(users.changeEmail).toHaveBeenCalledWith(userId, dto);
  });

  it("confirmEmailChange", () => {
    const { controller, users } = makeController();
    const dto = { code: "123456" };
    void controller.confirmEmailChange(payload, dto, "some-ua");
    expect(users.confirmEmailChange).toHaveBeenCalledWith(
      userId,
      dto,
      "some-ua",
    );
  });

  it("changePassword", () => {
    const { controller, users } = makeController();
    const dto = { currentPassword: "old", newPassword: "new" };
    void controller.changePassword(payload, dto, "some-ua");
    expect(users.changePassword).toHaveBeenCalledWith(userId, dto, "some-ua");
  });

  it("deletionSummary", () => {
    const { controller, users } = makeController();
    void controller.deletionSummary(payload);
    expect(users.deletionSummary).toHaveBeenCalledWith(userId);
  });

  it("deleteAccount", () => {
    const { controller, users } = makeController();
    const dto = { currentPassword: "pw" };
    void controller.deleteAccount(payload, dto, "some-ua");
    expect(users.deleteAccount).toHaveBeenCalledWith(userId, dto, "some-ua");
  });

  it("checkUsernameAvailability", () => {
    const { controller, users } = makeController();
    void controller.checkUsernameAvailability(payload, "alice");
    expect(users.checkUsernameAvailability).toHaveBeenCalledWith(
      userId,
      "alice",
    );
  });

  it("updateUsername", () => {
    const { controller, users } = makeController();
    const dto = { username: "alice2" };
    void controller.updateUsername(payload, dto);
    expect(users.updateUsername).toHaveBeenCalledWith(userId, dto);
  });
});
