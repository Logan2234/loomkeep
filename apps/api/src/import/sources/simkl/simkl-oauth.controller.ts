import { Controller, Get, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply } from "fastify";
import { Public } from "../../../auth/decorators/public.decorator";
import { simklAuthorizeUrl } from "./simkl-oauth.util";

/**
 * Kicks off Simkl's OAuth authorization-code flow. Deliberately its own
 * controller rather than a route on the generic {@link ImportController}:
 * this is a plain redirect, not analyze/commit, and lives at a fixed path
 * (`/simkl/connect`, not nested under `/import`) to avoid any ambiguity with
 * that controller's `:source/:jobId` routes.
 *
 * Once the user approves consent, Simkl redirects the browser to the web
 * app's own `/app/settings/import/simkl/callback?code=...` — that page hands
 * the code to `POST /import/simkl/analyze` as the ordinary `input` string, so
 * {@link SimklImportSource} needs no new job/DTO shape, just a source that
 * happens to treat its "raw input" as an OAuth code instead of a username.
 */
@Public()
@Controller("simkl")
export class SimklOAuthController {
  constructor(private readonly config: ConfigService) {}

  @Get("connect")
  connect(@Res() reply: FastifyReply): void {
    const clientId = this.config.getOrThrow<string>("SIMKL_CLIENT_ID");
    const webOrigin =
      this.config.get<string>("WEB_ORIGIN") ?? "http://localhost:5173";
    reply.redirect(simklAuthorizeUrl(clientId, webOrigin));
  }
}
