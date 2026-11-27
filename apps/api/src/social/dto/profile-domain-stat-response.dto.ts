import type { ProfileDomainStatDto } from "@loomkeep/shared/contracts";
import type { Domain } from "@loomkeep/shared/enums";

export class ProfileDomainStatResponseDto implements ProfileDomainStatDto {
  domain!: Domain;
  visible!: boolean;
  count!: number;
  favorites!: number;
}
