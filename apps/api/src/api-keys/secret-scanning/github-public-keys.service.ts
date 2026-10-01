import { Injectable } from "@nestjs/common";

const KEYS_URL = "https://api.github.com/meta/public_keys/secret_scanning";
const REFETCH_INTERVAL_MS = 60_000;

export interface GithubPublicKey {
  key_identifier: string;
  /** PEM, ECDSA P-256. */
  key: string;
  is_current: boolean;
}

/**
 * The keys GitHub signs its secret scanning alerts with. Kept in memory;
 * GitHub rotates them, so an identifier we don't know yet triggers a refetch
 * — at most once a minute, so a forged identifier can't make us hammer
 * api.github.com.
 */
@Injectable()
export class GithubPublicKeysService {
  private keys = new Map<string, string>();
  private fetchedAt = 0;

  async keyFor(identifier: string): Promise<string | null> {
    if (
      !this.keys.has(identifier) &&
      Date.now() - this.fetchedAt >= REFETCH_INTERVAL_MS
    ) {
      this.fetchedAt = Date.now();
      const keys = await this.fetchKeys();
      this.keys = new Map(keys.map((k) => [k.key_identifier, k.key]));
    }

    return this.keys.get(identifier) ?? null;
  }

  async fetchKeys(): Promise<GithubPublicKey[]> {
    const response = await fetch(KEYS_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Loomkeep",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`GitHub public keys: HTTP ${response.status}`);
    }

    const body = (await response.json()) as { public_keys?: GithubPublicKey[] };
    return body.public_keys ?? [];
  }
}
