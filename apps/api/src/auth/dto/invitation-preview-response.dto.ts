import type { InvitationPreviewDto } from "@loomkeep/shared";

export class InvitationPreviewResponseDto implements InvitationPreviewDto {
  inviterName!: string | null;
  email!: string | null;
  expiresAt!: string;
}
