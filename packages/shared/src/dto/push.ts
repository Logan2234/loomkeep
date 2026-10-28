export const PUSH_LIMITS = { title: 100, body: 500 } as const;

/** Web Push subscription payload, as returned by PushManager.subscribe(). */
export interface PushSubscriptionRequestDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** The Android app's Firebase Cloud Messaging registration token. */
export interface NativePushSubscriptionRequestDto {
  token: string;
  /** The installed APK draws its notifications itself, with buttons (MOB-17). */
  actions?: boolean;
}

export interface PushPublicKeyDto {
  /** VAPID public key; empty when Web Push is off on this instance. */
  publicKey: string;
  /** Whether this instance can push to the Android app (FCM configured). */
  nativeEnabled: boolean;
}

/** How many devices of the account receive push (Settings › Communications). */
export interface PushDeviceCountDto {
  count: number;
}
