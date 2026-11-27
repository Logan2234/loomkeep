import type {
  XpHistoryDayDto,
  XpHistoryItemDto,
} from "@loomkeep/shared/contracts";
import type { XpReason } from "@loomkeep/shared/enums";

export class XpHistoryItemResponseDto implements XpHistoryItemDto {
  reason!: XpReason;
  revoked!: boolean;
  amount!: number;
  at!: string;
  revokedAt!: string | null;
  earnedAt!: string | null;
  title!: string | null;
  href!: string | null;
  seasonNumber!: number | null;
  episodeNumber!: number | null;
  achievementKey!: string | null;
  domain!: string | null;
  goalTarget!: number | null;
  goalYear!: number | null;
}

export class XpHistoryDayResponseDto implements XpHistoryDayDto {
  day!: string;
  net!: number;
  items!: XpHistoryItemResponseDto[];
}
