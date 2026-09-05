import type {
  AchievementDto,
  AchievementFamily,
  AchievementTier,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

/**
 * A real class (not an inline object literal in `progress`'s own
 * `@ApiProperty`) so the Swagger CLI plugin infers `current`/`target` as
 * required from their plain, non-optional types — an inline schema has no
 * class fields for the plugin to read, so it generated both as optional,
 * which then made the whole `AchievementDto` un-assignable wherever a
 * stricter caller (the [G9] profile showcase) needed the real shared type.
 * Deliberately not exported: nothing outside this file references it, and
 * `AchievementResponseDto` below only needs it as a type for `@ApiProperty` —
 * exporting it would fail both the response-DTO `implements` convention test
 * (no matching shared-package interface exists for a bare progress shape)
 * and knip's unused-export check.
 */
class AchievementProgressResponseDto {
  current!: number;
  target!: number;
}

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

  @ApiProperty({ type: AchievementProgressResponseDto, nullable: true })
  progress!: { current: number; target: number } | null;

  equipped!: boolean;
}
