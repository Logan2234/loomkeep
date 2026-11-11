import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { vi } from "vitest";
import type { AdultImageKeysService } from "./adult-image-keys.service";
import { NativeAppAdultImagesInterceptor } from "./native-app-adult-images.interceptor";

const POSTER = "https://image.tmdb.org/t/p/w500/adult.jpg";

function run(userAgent: string | undefined) {
  const keys = {
    get: vi.fn().mockResolvedValue(new Set<string>()),
  } as unknown as AdultImageKeysService;
  const interceptor = new NativeAppAdultImagesInterceptor(keys);
  const context = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ headers: { "user-agent": userAgent } }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = {
    handle: () => of({ isAdult: true, posterUrl: POSTER }),
  };

  return lastValueFrom(interceptor.intercept(context, next));
}

describe("NativeAppAdultImagesInterceptor", () => {
  it("hides 18+ images from the Android app", async () => {
    const body = await run(
      "Mozilla/5.0 (Linux; Android 15) LoomkeepApp/1.13.0",
    );

    expect(body).toEqual({ isAdult: true, posterUrl: null });
  });

  it("leaves the website's responses as they are", async () => {
    const body = await run("Mozilla/5.0 (Windows NT 10.0) Chrome/140");

    expect(body).toEqual({ isAdult: true, posterUrl: POSTER });
  });
});
