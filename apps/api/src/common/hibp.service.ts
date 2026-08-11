import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";

const RANGE_API_TIMEOUT_MS = 3000;

/**
 * Checks passwords against Have I Been Pwned's k-anonymity range API: only a
 * 5-char SHA-1 prefix ever leaves the server, never the password itself.
 * Fails open (treats the password as not pwned) on any network error or
 * timeout — an HIBP outage, or a self-host without outbound internet access,
 * must never block signup/password-change.
 */
@Injectable()
export class HibpService {
  private readonly logger = new Logger(HibpService.name);

  async isPasswordPwned(password: string): Promise<boolean> {
    const sha1 = createHash("sha1")
      .update(password) // codeql[js/insufficient-password-hash]: SHA-1 is the HIBP range API's own lookup key format (k-anonymity), not used for credential storage.
      .digest("hex")
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: { "Add-Padding": "true" },
          signal: AbortSignal.timeout(RANGE_API_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `HIBP range lookup failed with status ${response.status}`,
        );
        return false;
      }

      const body = await response.text();

      for (const line of body.split("\n")) {
        const [lineSuffix, count] = line.trim().split(":");

        if (lineSuffix === suffix) {
          return Number(count) > 0;
        }
      }

      return false;
    } catch (err) {
      this.logger.warn(`HIBP range lookup failed: ${(err as Error).message}`);
      return false;
    }
  }
}
