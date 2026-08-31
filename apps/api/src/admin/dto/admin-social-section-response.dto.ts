import type { AdminSocialSectionDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { AdminSocialStatsResponseDto } from "./admin-social-stats-response.dto";

// AdminSocialSectionDto is a 2-branch discriminated union (disabled vs
// enabled-with-full-stats) — same @ApiExtraModels + oneOf technique as
// auth/dto/login-response.dto.ts, composed in the controller.
type DisabledSocialSection = Extract<AdminSocialSectionDto, { enabled: false }>;
type EnabledSocialSection = Extract<AdminSocialSectionDto, { enabled: true }>;

export class DisabledSocialSectionResponseDto implements DisabledSocialSection {
  @ApiProperty({ enum: [false] })
  enabled!: false;
}

export class EnabledSocialSectionResponseDto
  extends AdminSocialStatsResponseDto
  implements EnabledSocialSection
{
  @ApiProperty({ enum: [true] })
  enabled!: true;
}
