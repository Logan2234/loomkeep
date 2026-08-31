import type { UsernameAvailabilityDto } from "@loomkeep/shared";

export class UsernameAvailabilityResponseDto implements UsernameAvailabilityDto {
  available!: boolean;
}
