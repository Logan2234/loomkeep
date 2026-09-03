import type {
  AchievementDto,
  AchievementFamily,
  AchievementTier,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

/**
 * One catalogue entry projected for the current user (GET /achievements).
 * Every nullable field here is null at once for a still-locked secret — see
 * `AchievementDto` for why the masking lives server-side.
 */
export class AchievementResponseDto implements AchievementDto {
  @ApiProperty({ type: String, nullable: true })
  key!: string | null;

  @ApiProperty({
    enum: [
      "volume",
      "ritual",
      "exploration",
      "completion",
      "seasonal",
      "social",
      "account",
      "misc",
    ],
  })
  family!: AchievementFamily;

  @ApiProperty({ type: String, nullable: true })
  tierOf!: string | null;

  @ApiProperty({ enum: ["bronze", "silver", "gold"], nullable: true })
  tier!: AchievementTier | null;

  @ApiProperty({ type: Number, nullable: true })
  xpAward!: number | null;

  secret!: boolean;

  unlocked!: boolean;

  @ApiProperty({ type: String, nullable: true })
  unlockedAt!: string | null;

  @ApiProperty({
    type: "object",
    nullable: true,
    additionalProperties: false,
    properties: {
      current: { type: "number" },
      target: { type: "number" },
    },
  })
  progress!: { current: number; target: number } | null;
}
