import { createSign } from "node:crypto";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
// Renew the OAuth token this long before Google says it expires.
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** The FCM HTTP v1 `Message`, minus the `token` set by `send()`. */
export interface FcmMessage {
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: {
    priority: "HIGH" | "NORMAL";
    notification: { channel_id: string; tag?: string };
  };
}

export type FcmSendResult =
  | { ok: true }
  | {
      ok: false;
      /** The token is dead (app uninstalled, data cleared): drop it. */
      unregistered: boolean;
      error: string;
    };

/**
 * Firebase Cloud Messaging's HTTP v1 API, authenticated as the service
 * account Firebase issues for the project, with no SDK: a JWT signed with
 * its key is traded for an OAuth token, cached until shortly before expiry.
 */
export class FcmClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * From FCM_SERVICE_ACCOUNT_BASE64: the service account JSON Firebase
   * downloads (Project settings › Service accounts), base64-encoded so it
   * fits on one .env line. Null when unset, so native push stays off.
   */
  static fromEnv(
    value = process.env.FCM_SERVICE_ACCOUNT_BASE64,
  ): FcmClient | null {
    if (!value) return null;
    const account = JSON.parse(
      Buffer.from(value, "base64").toString("utf8"),
    ) as Partial<ServiceAccount>;

    if (!account.project_id || !account.client_email || !account.private_key) {
      throw new Error(
        "FCM_SERVICE_ACCOUNT_BASE64 lacks project_id, client_email or private_key",
      );
    }

    return new FcmClient(account as ServiceAccount);
  }

  async send(token: string, message: FcmMessage): Promise<FcmSendResult> {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.oauthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { token, ...message } }),
      },
    );
    if (response.ok) return { ok: true };

    const code = fcmErrorCode(await response.json().catch(() => null));
    return {
      ok: false,
      unregistered: code === "UNREGISTERED",
      error: `HTTP ${response.status}${code ? ` ${code}` : ""}`,
    };
  }

  private async oauthToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > this.now()) {
      return this.accessToken.value;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: this.signedAssertion(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `FCM OAuth token request failed: HTTP ${response.status}`,
      );
    }

    const { access_token, expires_in } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = {
      value: access_token,
      expiresAt: this.now() + expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
    };
    return access_token;
  }

  private signedAssertion(): string {
    const issuedAt = Math.floor(this.now() / 1000);
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
      iss: this.account.client_email,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })}`;
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(this.account.private_key, "base64url");
    return `${unsigned}.${signature}`;
  }
}

/** FCM puts its own code in the error details, Google's generic one in `status`. */
function fcmErrorCode(body: unknown): string | undefined {
  const error = (
    body as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    } | null
  )?.error;
  return (
    error?.details?.find((detail) => detail.errorCode)?.errorCode ??
    error?.status
  );
}
