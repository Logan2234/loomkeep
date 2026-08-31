import type { GhostSwitchImpactDto } from "@loomkeep/shared";

export class GhostSwitchImpactResponseDto implements GhostSwitchImpactDto {
  followersToRemove!: number;
  outgoingFollowsToCancel!: number;
  listsToDowngrade!: number;
}
