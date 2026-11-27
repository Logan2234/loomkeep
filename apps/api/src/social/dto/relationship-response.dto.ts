import type { RelationshipDto } from "@loomkeep/shared/contracts";

export class RelationshipResponseDto implements RelationshipDto {
  isSelf!: boolean;
  following!: boolean;
  requested!: boolean;
  followsYou!: boolean;
  isFriend!: boolean;
  blocking!: boolean;
}
