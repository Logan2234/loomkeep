import type {
  ActivityDomain,
  ActivityEventDto,
  ActivityLevel,
  ActivityType,
} from "@loomkeep/shared";
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
