import { describe, expect, it, vi } from "vitest";
import { createLatestEmailPreviewRequest } from "./email-preview";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createLatestEmailPreviewRequest", () => {
  it("ignores an older response that completes after the latest request", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const request = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const onSuccess = vi.fn();
    const onSettled = vi.fn();
    const load = createLatestEmailPreviewRequest(request, {
      onStart: vi.fn(),
      onSuccess,
      onError: vi.fn(),
      onSettled,
    });

    const firstLoad = load();
    const secondLoad = load();
    second.resolve("latest");
    await secondLoad;
    first.resolve("stale");
    await firstLoad;

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith("latest");
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("reports only the latest request failure", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const onError = vi.fn();
    const load = createLatestEmailPreviewRequest(
      vi
        .fn<() => Promise<string>>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
      {
        onStart: vi.fn(),
        onSuccess: vi.fn(),
        onError,
        onSettled: vi.fn(),
      },
    );

    const firstLoad = load();
    const secondLoad = load();
    first.reject(new Error("stale failure"));
    await firstLoad;
    second.reject(new Error("latest failure"));
    await secondLoad;

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "latest failure",
      }),
    );
  });
});
