import type { PushPublicKeyDto } from "@loomkeep/shared";

export class PushPublicKeyResponseDto implements PushPublicKeyDto {
  publicKey!: string;
}
