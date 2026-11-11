import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { from, mergeMap, type Observable } from "rxjs";
import { AdultImageKeysService } from "./adult-image-keys.service";
import { stripAdultImages } from "./adult-images.util";

// Appended to the WebView's user agent by apps/mobile/capacitor.config.ts.
const NATIVE_APP_AGENT = "LoomkeepApp/";

/**
 * Google Play bans pornography even behind an age gate, so the Android app
 * never shows an 18+ work's images; the website still does for adults who
 * opted in.
 */
@Injectable()
export class NativeAppAdultImagesInterceptor implements NestInterceptor {
  constructor(private readonly adultImageKeys: AdultImageKeysService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (!request.headers["user-agent"]?.includes(NATIVE_APP_AGENT)) {
      return next.handle();
    }

    return next
      .handle()
      .pipe(
        mergeMap((body: unknown) =>
          from(
            this.adultImageKeys
              .get()
              .then((keys) => stripAdultImages(body, keys)),
          ),
        ),
      );
  }
}
