import type {
  OnboardingChecklistDto,
  OnboardingStepDto,
  OnboardingStepKey,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class OnboardingStepResponseDto implements OnboardingStepDto {
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
