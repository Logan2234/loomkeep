import type { GhostSwitchImpactDto } from "@loomkeep/shared/contracts";

export class GhostSwitchImpactResponseDto implements GhostSwitchImpactDto {
  followersToRemove!: number;
  outgoingFollowsToCancel!: number;
  listsToDowngrade!: number;
}
