import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ParsedImport } from "../../media-import-model";
import { MediaImportSource } from "../media/media-import.source";
import { buildImportMovies, buildImportShows } from "./parse-simkl";
import { simklRedirectUri } from "./simkl-oauth.util";
import type { SimklAllItemsResponse } from "./simkl-api.types";

const SIMKL_API = "https://api.simkl.com";

/** Parse model: the raw OAuth code, filled in with the fetched export by {@link load}. */
interface SimklParsed extends ParsedImport {
  code: string;
}

/**
 * Simkl import: Simkl's own account-data export is gated behind a paid VIP
 * plan (verified directly on simkl.com/apps/backup/, not just its docs), so —
 * unlike Trakt/Steam — there is no "public profile" shortcut here either.
 * Every user's data requires a per-user OAuth `access_token`, obtained via the
 * authorization-code flow kicked off by {@link SimklOAuthController}. This
 * source only ever sees the resulting `code` (as the ordinary `input` string)
 * and exchanges it for a token itself, once, during {@link load}.
 */
@Injectable()
export class SimklImportSource extends MediaImportSource<SimklParsed> {
  readonly id = "simkl";
  readonly requiredEnvKeys = ["SIMKL_CLIENT_ID", "SIMKL_CLIENT_SECRET"];

  constructor(
    prisma: PrismaService,
    mediaItemService: MediaItemService,
    tmdb: TmdbProvider,
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {
    super(prisma, mediaItemService, tmdb);
  }

  parseInput(input: string): SimklParsed {
    return { source: this.id, code: input.trim(), shows: [], movies: [] };
  }

  protected async load(parsed: SimklParsed): Promise<void> {
    const accessToken = await this.exchangeCode(parsed.code);
    const data = await this.getAllItems(accessToken);
    parsed.shows = buildImportShows(data);
    parsed.movies = buildImportMovies(data);
  }

  /** `POST /oauth/token` — a code is single-use, so this only ever runs once. */
  private async exchangeCode(code: string): Promise<string> {
    const clientId = this.configService.getOrThrow<string>("SIMKL_CLIENT_ID");
    const clientSecret = this.configService.getOrThrow<string>(
      "SIMKL_CLIENT_SECRET",
    );
    const webOrigin =
      this.configService.get<string>("WEB_ORIGIN") ?? "http://localhost:5173";

    this.quota.record("simkl");
    const response = await fetch(`${SIMKL_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: simklRedirectUri(webOrigin),
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(
        "Connexion à Simkl impossible — la demande a peut-être expiré ou déjà été utilisée, réessaie depuis le début.",
      );
    }

    const data = (await response.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new BadRequestException("Connexion à Simkl impossible.");
    }

    return data.access_token;
  }

  /**
   * `GET /sync/all-items/all/all` — the single endpoint covering every type
   * and status at once (Simkl's own guide explicitly recommends this shape
   * for a one-off full pull, as opposed to polling on a timer).
   */
  private async getAllItems(
    accessToken: string,
  ): Promise<SimklAllItemsResponse> {
    const clientId = this.configService.getOrThrow<string>("SIMKL_CLIENT_ID");
    const url = new URL(`${SIMKL_API}/sync/all-items/all/all`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("extended", "full");
    url.searchParams.set("episode_watched_at", "yes");
    url.searchParams.set("include_all_episodes", "yes");

    this.quota.record("simkl");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Simkl request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as SimklAllItemsResponse;
  }
}
