import type { NativePushSubscriptionRequestDto } from "@loomkeep/shared";
import { Matches } from "class-validator";

export class NativePushSubscriptionDto implements NativePushSubscriptionRequestDto {
  // FCM registration tokens are opaque URL-safe strings; this only keeps
  // anything else out, the token never reaches a URL.
  @Matches(/^[\w:-]{20,4096}$/)
  token!: string;
}
