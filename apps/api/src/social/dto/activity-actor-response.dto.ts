import type { ActivityActorDto } from "@loomkeep/shared";

export class ActivityActorResponseDto implements ActivityActorDto {
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
}
