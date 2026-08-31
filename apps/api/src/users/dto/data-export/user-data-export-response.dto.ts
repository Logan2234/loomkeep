import type { UserDataExportDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../user-response.dto";
import { DataExportBlockResponseDto } from "./data-export-block-response.dto";
import { DataExportBookEntryResponseDto } from "./data-export-book-entry-response.dto";
import { DataExportCommentReactionResponseDto } from "./data-export-comment-reaction-response.dto";
import { DataExportCommentResponseDto } from "./data-export-comment-response.dto";
import { DataExportDeviceResponseDto } from "./data-export-device-response.dto";
import { DataExportEntitlementResponseDto } from "./data-export-entitlement-response.dto";
import { DataExportEntryResponseDto } from "./data-export-entry-response.dto";
import { DataExportFollowResponseDto } from "./data-export-follow-response.dto";
import { DataExportGameEntryResponseDto } from "./data-export-game-entry-response.dto";
import { DataExportImportRunResponseDto } from "./data-export-import-run-response.dto";
import { DataExportListMembershipResponseDto } from "./data-export-list-membership-response.dto";
import { DataExportListResponseDto } from "./data-export-list-response.dto";
import { DataExportModerationDecisionResponseDto } from "./data-export-moderation-decision-response.dto";
import { DataExportMusicEntryResponseDto } from "./data-export-music-entry-response.dto";
import { DataExportNotificationResponseDto } from "./data-export-notification-response.dto";
import { DataExportReadingGoalResponseDto } from "./data-export-reading-goal-response.dto";
import { DataExportReportResponseDto } from "./data-export-report-response.dto";
import { DataExportReviewResponseDto } from "./data-export-review-response.dto";
import { DataExportReviewVoteResponseDto } from "./data-export-review-vote-response.dto";
import { DataExportSecurityEventResponseDto } from "./data-export-security-event-response.dto";
import { DataExportSubscriptionResponseDto } from "./data-export-subscription-response.dto";
import { DataExportVisibilitySettingResponseDto } from "./data-export-visibility-setting-response.dto";
import { DataExportWatchResponseDto } from "./data-export-watch-response.dto";

class DataExportFollowsResponseDto {
  following!: DataExportFollowResponseDto[];
  followers!: DataExportFollowResponseDto[];
}

class DataExportBlocksResponseDto {
  blocking!: DataExportBlockResponseDto[];
}

export class UserDataExportResponseDto implements UserDataExportDto {
  exportedAt!: string;
  account!: UserResponseDto;
  library!: DataExportEntryResponseDto[];
  episodeWatches!: DataExportWatchResponseDto[];
  games!: DataExportGameEntryResponseDto[];
  books!: DataExportBookEntryResponseDto[];
  music!: DataExportMusicEntryResponseDto[];

  // `never[]` (always empty — the domain isn't shipped yet) makes the
  // swagger plugin mistake the property for a self-reference and throw a
  // "circular dependency" error at generation time — an explicit primitive
  // array type sidesteps its type-reference resolution entirely.
  @ApiProperty({ type: [String] })
  podcasts!: never[];

  @ApiProperty({ type: [String] })
  boardGames!: never[];

  notifications!: DataExportNotificationResponseDto[];
  reviews!: DataExportReviewResponseDto[];
  reviewVotes!: DataExportReviewVoteResponseDto[];
  comments!: DataExportCommentResponseDto[];
  commentReactions!: DataExportCommentReactionResponseDto[];
  lists!: DataExportListResponseDto[];
  listMemberships!: DataExportListMembershipResponseDto[];
  follows!: DataExportFollowsResponseDto;
  blocks!: DataExportBlocksResponseDto;
  reports!: DataExportReportResponseDto[];
  moderationDecisions!: DataExportModerationDecisionResponseDto[];
  securityEvents!: DataExportSecurityEventResponseDto[];
  devices!: DataExportDeviceResponseDto[];
  visibilitySettings!: DataExportVisibilitySettingResponseDto[];
  entitlement!: DataExportEntitlementResponseDto;
  subscriptions!: DataExportSubscriptionResponseDto[];
  readingGoals!: DataExportReadingGoalResponseDto[];
  importRuns!: DataExportImportRunResponseDto[];
}
