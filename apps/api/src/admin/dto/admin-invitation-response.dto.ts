import type {
  AdminInvitationDto,
  AdminInvitationRedeemerDto,
  AdminInvitationStatus,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

class AdminInvitationRedeemerResponseDto implements AdminInvitationRedeemerDto {
  id!: string;
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
}

export class AdminInvitationResponseDto implements AdminInvitationDto {
  id!: string;
  email!: string | null;
  label!: string | null;
  maxUses!: number;
  useCount!: number;
  @ApiProperty({ enum: ["pending", "used", "expired", "revoked"] })
  status!: AdminInvitationStatus;

  expiresAt!: string;
  revokedAt!: string | null;
  emailedAt!: string | null;
  createdAt!: string;
  createdByName!: string | null;
  redeemedBy!: AdminInvitationRedeemerResponseDto[];
}
