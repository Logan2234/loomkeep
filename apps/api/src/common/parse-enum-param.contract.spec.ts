import { ErrorCode } from "@loomkeep/shared";
import { AppException } from "./app.exception";
import { parseEnumParam } from "./parse-enum-param.util";

describe("enum route contracts", () => {
  it("preserves default normalization", () => {
    expect(parseEnumParam("books", ["BOOKS"], "domain")).toBe("BOOKS");
  });
  it("keeps case-sensitive error codes, messages and omitted interpolation params", () => {
    try {
      parseEnumParam("media", ["MEDIA"], "target", {
        caseSensitive: true,
        errorCode: ErrorCode.CommentUnknownTargetType,
        includeDetails: false,
        message: ErrorCode.CommentUnknownTargetType,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.getStatus()).toBe(400);
      expect(exception.code).toBe(ErrorCode.CommentUnknownTargetType);
      expect(exception.params).toBeUndefined();
      expect(exception.message).toBe(ErrorCode.CommentUnknownTargetType);
    }
  });
});
