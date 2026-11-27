import type {
  ActivityDomain,
  ActivityEventDto,
  ActivityLevel,
} from "@loomkeep/shared/contracts";
import type { ActivityType } from "@loomkeep/shared/enums";
import { ActivityActorResponseDto } from "./activity-actor-response.dto";

export class ActivityEventResponseDto implements ActivityEventDto {
  id!: string;
  type!: ActivityType;
  domain!: ActivityDomain;
  targetType!: string;
  level!: ActivityLevel;
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
  data!: Record<string, unknown>;
  createdAt!: string;
  actor!: ActivityActorResponseDto;
  count!: number;
}
