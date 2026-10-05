export const PUSH_LIMITS = { title: 100, body: 500 } as const;

/** Web Push subscription payload, as returned by PushManager.subscribe(). */
export interface PushSubscriptionRequestDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPublicKeyDto {
  publicKey: string;
}

/** How many devices of the account receive push (Settings › Communications). */
export interface PushDeviceCountDto {
  count: number;
}
