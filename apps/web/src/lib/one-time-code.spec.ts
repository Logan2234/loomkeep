import { describe, expect, it } from "vitest";
import { formatRecoveryCode } from "./one-time-code.js";

describe("formatRecoveryCode", () => {
  it("upper-cases what's typed", () => {
    expect(formatRecoveryCode("abc", "ab")).toBe("ABC");
  });

  it("adds the dash once the first half is typed", () => {
    expect(formatRecoveryCode("ABCDe", "ABCD")).toBe("ABCDE-");
    expect(formatRecoveryCode("ABCDE-1", "ABCDE-")).toBe("ABCDE-1");
  });

  it("formats a pasted code, whatever its spacing or case", () => {
    expect(formatRecoveryCode(" abcde 12345 ", "")).toBe("ABCDE-12345");
    expect(formatRecoveryCode("abcde-12345", "")).toBe("ABCDE-12345");
  });

  it("stops at the code's length", () => {
    expect(formatRecoveryCode("ABCDE-123456", "ABCDE-12345")).toBe(
      "ABCDE-12345",
    );
  });

  it("takes the character before the dash along with it", () => {
    expect(formatRecoveryCode("ABCDE", "ABCDE-")).toBe("ABCD");
  });

  it("erases one character at a time after the dash", () => {
    expect(formatRecoveryCode("ABCDE-", "ABCDE-1")).toBe("ABCDE-");
  });
});
