import type { InvitationPreviewDto } from "@loomkeep/shared/contracts";

export class InvitationPreviewResponseDto implements InvitationPreviewDto {
  inviterName!: string | null;
  email!: string | null;
  expiresAt!: string;
}
