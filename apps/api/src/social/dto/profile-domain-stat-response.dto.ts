import type { Domain, ProfileDomainStatDto } from "@loomkeep/shared";

export class ProfileDomainStatResponseDto implements ProfileDomainStatDto {
  domain!: Domain;
  visible!: boolean;
  count!: number;
  favorites!: number;
}
