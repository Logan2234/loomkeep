import { createHmac, timingSafeEqual } from "node:crypto";

/** What a button on an Android notification can do without opening the app (MOB-17). */
export const NotificationAction = {
  CHAT_REPLY: "chat.reply",
  CHAT_READ: "chat.read",
  FOLLOW_ACCEPT: "follow.accept",
  FOLLOW_REJECT: "follow.reject",
  FOLLOW_BACK: "follow.back",
  COMMENT_REPLY: "comment.reply",
  PLAN_WORK: "work.plan",
  MARK_READ: "notification.read",
  /** A sample's button (Admin › Communications): reaches the API, does nothing. */
  TEST: "test",
} as const;

export type NotificationAction =
  (typeof NotificationAction)[keyof typeof NotificationAction];

/** A button, before its token is minted for one device. */
export interface PushAction {
  action: NotificationAction;
  label: string;
  /** What the action applies to: ids, a username… */
  target: Record<string, string>;
  /** Present for a direct reply: the hint shown in the reply field. */
  replyHint?: string;
}

export interface ActionClaims {
  action: NotificationAction;
  target: Record<string, string>;
  /** The push subscription it was minted for: deleting it revokes the token. */
  subscriptionId: string;
  /** The bell entry the push announced, marked read once the action is done. */
  notificationId?: string;
  expiresAt: number;
}

const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// The access-token secret, but never its value: a key derived for this use
// only, so an action token can't be mistaken for anything else it signs.
function signingKey(): Buffer {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return createHmac("sha256", secret).update("notification-action").digest();
}

const signature = (payload: string): Buffer =>
  createHmac("sha256", signingKey()).update(payload).digest();

/**
 * A token carrying one action on one target, for one device: the button
 * sends it back to `POST /notifications/actions`, which needs no session.
 */
export function signAction(
  claims: Omit<ActionClaims, "expiresAt">,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...claims, expiresAt: now + TOKEN_LIFETIME_MS }),
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

/** The token's claims, or null when it was tampered with or has expired. */
export function verifyAction(
  token: string,
  now = Date.now(),
): ActionClaims | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;

  const expected = signature(payload);
  const provided = Buffer.from(sig, "base64url");

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  const claims = JSON.parse(
    Buffer.from(payload, "base64url").toString(),
  ) as ActionClaims;
  return claims.expiresAt > now ? claims : null;
}
