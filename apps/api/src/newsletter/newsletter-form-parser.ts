import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import { AppException } from "../common/app.exception";

/** Nest already parses URL-encoded forms; RFC 8058 also permits multipart forms. */
export function registerNewsletterFormParser(app: FastifyInstance): void {
  const endpoint = "/api/newsletter/unsubscribe/one-click";
  app.addHook("onRoute", (route) => {
    if (route.url === endpoint) route.bodyLimit = 4096;
  });
  app.addContentTypeParser(
    "multipart/form-data",
    { parseAs: "string", bodyLimit: 4096 },
    (request, body, done) => {
      if (request.url.split("?")[0] !== endpoint) {
        done(
          new AppException(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            ErrorCode.ValidationFailed,
            undefined,
            "Unsupported form endpoint",
          ),
        );
        return;
      }

      const form = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": request.headers["content-type"]! },
        body: body as string,
      });
      void form.formData().then(
        (data) => done(null, Object.fromEntries(data)),
        () =>
          done(
            new AppException(
              HttpStatus.BAD_REQUEST,
              ErrorCode.ValidationFailed,
              undefined,
              "Invalid unsubscribe form",
            ),
          ),
      );
    },
  );
}
