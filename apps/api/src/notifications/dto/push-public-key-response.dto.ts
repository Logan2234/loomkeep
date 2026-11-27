import type { PushPublicKeyDto } from "@loomkeep/shared/contracts";

export class PushPublicKeyResponseDto implements PushPublicKeyDto {
  publicKey!: string;
  nativeEnabled!: boolean;
}
