import type {
  OnboardingChecklistDto,
  OnboardingStepDto,
  OnboardingStepKey,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

// Not exported: nothing outside this file references it, and
// OnboardingChecklistResponseDto below only needs it as a type for
// @ApiProperty — exporting it would fail knip's unused-export check (see the
// [G9] precedent with AchievementProgressResponseDto).
class OnboardingStepResponseDto implements OnboardingStepDto {
  @ApiProperty({
    enum: [
      "add_title",
      "mark_complete",
      "rate",
      "complete_profile",
      "import",
      "create_list",
      "comment",
    ],
  })
  key!: OnboardingStepKey;

  done!: boolean;
  skipped!: boolean;
}

export class OnboardingChecklistResponseDto implements OnboardingChecklistDto {
  @ApiProperty({ type: OnboardingStepResponseDto, isArray: true })
  steps!: OnboardingStepDto[];

  allDone!: boolean;
}
