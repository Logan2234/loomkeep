import { Prisma } from "@prisma/client";
import { isUniqueViolation } from "./prisma-error.util";

function error(code: string, target?: string[] | string) {
  return new Prisma.PrismaClientKnownRequestError("Constraint failure", {
    code,
    clientVersion: "7",
    meta: { target },
  });
}

describe("isUniqueViolation", () => {
  it("recognizes P2002 without requiring target metadata", () => {
    expect(isUniqueViolation(error("P2002"))).toBe(true);
  });
  it.each([
    { target: ["email"] },
    { target: ["username", "email"] },
    { target: "User_email_key" },
  ])("retains registration's email matching for target %j", ({ target }) => {
    expect(isUniqueViolation(error("P2002", target), "email")).toBe(true);
  });
  it("does not report a username collision as an email collision", () => {
    expect(isUniqueViolation(error("P2002", ["username"]), "email")).toBe(
      false,
    );
    expect(isUniqueViolation(error("P2002"), "email")).toBe(false);
  });
  it("does not swallow other failures or look-alike errors", () => {
    expect(isUniqueViolation(error("P2025", ["email"]))).toBe(false);
    expect(
      isUniqueViolation({ code: "P2002", meta: { target: ["email"] } }),
    ).toBe(false);
  });
});
