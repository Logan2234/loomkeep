import type { PushSubscriptionRequestDto } from "@loomkeep/shared";
import { Type } from "class-transformer";
import { IsString, MaxLength, ValidateNested } from "class-validator";
import { IsPushEndpoint } from "../push-endpoint.validator";

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class PushSubscriptionDto implements PushSubscriptionRequestDto {
  // Restricted to known browser push service hosts (see IsPushEndpoint) —
  // otherwise this string reaches webpush.sendNotification() as-is
  // (PushService.sendToUserDetailed), letting an authenticated user make the
  // API server POST to an arbitrary URL.
  @IsPushEndpoint()
  @MaxLength(2048)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
