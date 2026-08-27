import { m } from "$lib/paraglide/messages.js";
import { ErrorCode } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "./core";
import { resolveApiError } from "./errors";

describe("resolveApiError", () => {
  it("resolves a known code to its translated message", () => {
    const err = new ApiError(404, "dev text", ErrorCode.LibraryEpisodeNotAired);

    expect(resolveApiError(err)).toBe(m.apierr_library_episode_not_aired());
  });

  it("falls back to the HTTP status when the code is null (not yet migrated to AppException)", () => {
    const err = new ApiError(404, "Not Found", null);

    expect(resolveApiError(err)).toBe(m.apierr_status_404());
  });

  it("falls back to the HTTP status when the code is unknown to this build (newer API)", () => {
    // Simulates a code this deployed/cached build's registry doesn't know
    // about yet — e.g. a service worker serving a stale bundle against a
    // newer API. Not a real ErrorCode value on purpose.
    const err = new ApiError(
      409,
      "dev text",
      "future.unknown_code" as ErrorCode,
    );

    expect(resolveApiError(err)).toBe(m.apierr_status_409());
  });

  it("falls back to the generic 5xx message for an unrecognized status", () => {
    const err = new ApiError(418, "I'm a teapot", null);

    expect(resolveApiError(err)).toBe(m.apierr_status_400());
  });

  it("falls back to the generic server-error message for a 5xx with no code", () => {
    const err = new ApiError(500, "boom", null);

    expect(resolveApiError(err)).toBe(m.apierr_status_500());
  });

  it("resolves a network failure (offline/VPS down) to its dedicated message", () => {
    const err = new ApiError(
      0,
      "Network request failed",
      ErrorCode.NetworkOffline,
    );

    expect(resolveApiError(err)).toBe(m.apierr_network_offline());
  });

  it("interpolates Retry-After into the 429 fallback when present", () => {
    const err = new ApiError(
      429,
      "Too Many Requests",
      null,
      undefined,
      undefined,
      undefined,
      30,
    );

    expect(resolveApiError(err)).toBe(
      m.apierr_status_429_retry({ seconds: 30 }),
    );
  });

  it("uses the generic 429 message when Retry-After wasn't sent", () => {
    const err = new ApiError(429, "Too Many Requests", null);

    expect(resolveApiError(err)).toBe(m.apierr_status_429());
  });

  it("falls back to the API's joined constraint messages for validation.failed (transition case)", () => {
    const err = new ApiError(
      400,
      "email: isEmail, password: minLength",
      ErrorCode.ValidationFailed,
    );

    expect(resolveApiError(err)).toBe("email: isEmail, password: minLength");
  });

  it("falls back to the generic validation message when the API sent no dev message", () => {
    const err = new ApiError(400, "", ErrorCode.ValidationFailed);

    expect(resolveApiError(err)).toBe(m.apierr_validation_failed());
  });

  it("returns the generic 5xx message for a non-ApiError (a bug in the calling code)", () => {
    expect(resolveApiError(new Error("unrelated bug"))).toBe(
      m.apierr_status_500(),
    );
    expect(resolveApiError("not even an Error")).toBe(m.apierr_status_500());
  });
});
