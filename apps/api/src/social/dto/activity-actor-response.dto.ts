import type { ActivityActorDto } from "@loomkeep/shared/contracts";

export class ActivityActorResponseDto implements ActivityActorDto {
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
}
