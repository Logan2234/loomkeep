import type { UsernameAvailabilityDto } from "@loomkeep/shared/contracts";

export class UsernameAvailabilityResponseDto implements UsernameAvailabilityDto {
  available!: boolean;
}
