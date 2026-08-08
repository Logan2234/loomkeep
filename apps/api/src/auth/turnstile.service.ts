import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Cloudflare Turnstile server-side verification, gating registration against
 * bot/scripted signups. Empty TURNSTILE_SECRET_KEY = disabled (self-host
 * without a Cloudflare account configured), same "empty disables the
 * feature" convention as every other optional integration in this app.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    const secret = this.config.get<string>("TURNSTILE_SECRET_KEY");
    if (!secret) return true;
    if (!token) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    try {
      const res = await fetch(VERIFY_URL, { method: "POST", body });
      const data = (await res.json()) as SiteverifyResponse;

      if (!data.success) {
        this.logger.warn(`Turnstile check failed: ${data["error-codes"]}`);
      }

      return data.success;
    } catch (err) {
      // Fail closed: a Cloudflare/network hiccup shouldn't silently disable
      // bot protection on the registration endpoint.
      this.logger.error("Turnstile verification request failed", err);
      return false;
    }
  }
}
