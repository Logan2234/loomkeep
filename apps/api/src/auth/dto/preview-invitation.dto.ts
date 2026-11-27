import type { InvitationPreviewRequestDto } from "@loomkeep/shared/contracts";
import { IsString, MaxLength } from "class-validator";

export class PreviewInvitationDto implements InvitationPreviewRequestDto {
  @IsString()
  @MaxLength(128)
  token!: string;
}
