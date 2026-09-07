import type { WebauthnCredentialDto } from "@loomkeep/shared";

export class WebauthnCredentialResponseDto implements WebauthnCredentialDto {
  id!: string;
  name!: string;
  deviceType!: "singleDevice" | "multiDevice";
  createdAt!: string;
  lastUsedAt!: string | null;
}
