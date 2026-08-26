import type { PushSubscriptionRequestDto } from "@loomkeep/shared";
import { Type } from "class-transformer";
import { IsString, ValidateNested } from "class-validator";

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class PushSubscriptionDto implements PushSubscriptionRequestDto {
  @IsString()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
