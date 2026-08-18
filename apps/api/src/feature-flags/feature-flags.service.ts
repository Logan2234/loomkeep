import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initialize, type Unleash } from "unleash-client";

/**
 * Thin wrapper around the Unleash SDK, optional by design: when
 * `UNLEASH_API_URL` is unset (self-host without the docker-compose.unleash.yml
 * add-on), isEnabled() always returns the caller's fallback — the app behaves
 * exactly as it did with plain env-var flags. Once Unleash is configured, an
 * existing flag there is authoritative; the fallback only kicks in while that
 * flag doesn't exist yet in Unleash or the client hasn't synced.
 */
@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private client?: Unleash;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>("UNLEASH_API_URL");
    if (!url) return;

    this.client = initialize({
      url,
      appName: "loomkeep-api",
      customHeaders: {
        Authorization: this.config.get<string>("UNLEASH_API_TOKEN") ?? "",
      },
    });
    this.client.on("error", (error: Error) => {
      this.logger.warn(`Unleash client error: ${error.message}`);
    });
  }

  onModuleDestroy(): void {
    this.client?.destroy();
  }

  /**
   * `fallback` applies while `name` doesn't exist yet in Unleash, or this
   * deployment doesn't run Unleash at all.
   */
  isEnabled(name: string, fallback: boolean = false): boolean {
    if (!this.client) return fallback;
    return this.client.isEnabled(name, undefined, fallback);
  }
}
