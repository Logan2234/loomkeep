import { registerDecorator, ValidationOptions } from "class-validator";

/**
 * Hosts of the browser push services actually in use (Mozilla, Chrome/Edge via
 * FCM, Safari, legacy Windows/UWP) — nothing else should ever be reachable
 * through a subscribed endpoint. Without this, `endpoint` was an unchecked
 * string that `PushService.sendToUserDetailed()` later hands straight to
 * `webpush.sendNotification()`, letting an authenticated user make the API
 * server POST to an arbitrary URL (the Docker-internal network, cloud
 * metadata endpoints…) and read back an oracle (the per-device HTTP status).
 */
const ALLOWED_PUSH_HOSTS = [
  /^([a-z0-9-]+\.)?push\.services\.mozilla\.com$/,
  /^fcm\.googleapis\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    ALLOWED_PUSH_HOSTS.some((pattern) => pattern.test(url.hostname))
  );
}

/** Restricts a push subscription's `endpoint` to a known browser push service host. */
export function IsPushEndpoint(options?: ValidationOptions) {
  return function (target: object, propertyName: string): void {
    registerDecorator({
      name: "isPushEndpoint",
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === "string" && isAllowedPushEndpoint(value);
        },
        defaultMessage(): string {
          return "endpoint must be a URL from a supported push service";
        },
      },
    });
  };
}
