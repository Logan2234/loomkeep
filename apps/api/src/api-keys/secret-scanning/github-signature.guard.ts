import { ErrorCode } from "@loomkeep/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { verify } from "node:crypto";
import { AppException } from "../../common/app.exception";
import { GithubPublicKeysService } from "./github-public-keys.service";

/**
 * Lets through only what GitHub signed: an ECDSA signature of the exact
 * request bytes (`rawBody: true` in main.ts), made with the key named in
 * `Github-Public-Key-Identifier`.
 */
@Injectable()
export class GithubSignatureGuard implements CanActivate {
  constructor(private readonly keys: GithubPublicKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { rawBody?: Buffer }>();
    const identifier = request.headers["github-public-key-identifier"];
    const signature = request.headers["github-public-key-signature"];

    if (
      typeof identifier !== "string" ||
      typeof signature !== "string" ||
      !request.rawBody
    ) {
      throw unauthorized();
    }

    const key = await this.keys.keyFor(identifier);

    if (!key || !isSignedBy(key, request.rawBody, signature)) {
      throw unauthorized();
    }

    return true;
  }
}

function unauthorized(): AppException {
  return new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.SecretScanningUnauthorized,
  );
}

function isSignedBy(key: string, body: Buffer, signature: string): boolean {
  try {
    return verify("sha256", body, key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
