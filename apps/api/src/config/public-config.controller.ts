import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PublicConfigDto } from "@loomkeep/shared";
import { Public } from "../auth/decorators/public.decorator";
import { isRegistrationEnabled } from "../auth/registration.config";
import { isSocialEnabled } from "../social/social.config";

// process.cwd() is apps/api in both dev (pnpm --filter) and the Docker image
// (WORKDIR) — same trick as admin-system.controller.ts's ROOT_PACKAGE_JSON.
const ROOT_PACKAGE_JSON = join(process.cwd(), "..", "..", "package.json");

// Unauthenticated: the web fetches this once at startup, before login, to know
// which optional surfaces (e.g. social) to render.
@Public()
@Controller("config")
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  async get(): Promise<PublicConfigDto> {
    const raw = await readFile(ROOT_PACKAGE_JSON, "utf-8");
    const { version } = JSON.parse(raw) as { version: string };

    return {
      socialEnabled: isSocialEnabled(this.config),
      registrationEnabled: isRegistrationEnabled(this.config),
      erdEnabled: this.config.get<string>("NODE_ENV") === "development",
      version,
      // Set at build time (see apps/api/Dockerfile) — "unknown" outside a
      // CI-built image (pnpm dev, or any docker compose run against a
      // locally-tagged image rather than one pulled from GHCR).
      gitSha: (process.env.GIT_SHA ?? "unknown").slice(0, 7),
    };
  }
}
