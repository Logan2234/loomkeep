import type { UserDataExportDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { SavedViewResponseDto } from "../../../saved-views/dto/saved-view.dto";
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
  /** Accounts followed. */
  following!: DataExportFollowResponseDto[];

  /** Accounts following this one. */
  followers!: DataExportFollowResponseDto[];
}

class DataExportBlocksResponseDto {
  /** Accounts blocked. */
  blocking!: DataExportBlockResponseDto[];
}

export class UserDataExportResponseDto implements UserDataExportDto {
  /**
   * When the export was made.
   * @example "2026-09-30T21:00:00.000Z"
   */
  exportedAt!: string;

  /** The account itself and its settings. */
  account!: UserResponseDto;

  /** Films, series and anime tracked. */
  library!: DataExportEntryResponseDto[];

  /** Every episode viewing, rewatches included. */
  episodeWatches!: DataExportWatchResponseDto[];

  /** Games tracked, with their sessions. */
  games!: DataExportGameEntryResponseDto[];

  /** Books tracked, with their sessions. */
  books!: DataExportBookEntryResponseDto[];

  /** Albums tracked. */
  music!: DataExportMusicEntryResponseDto[];

  /**
   * Reserved for a future domain; always empty.
   * @example []
   */
  // `never[]` (always empty — the domain isn't shipped yet) makes the
  // swagger plugin mistake the property for a self-reference and throw a
  // "circular dependency" error at generation time — an explicit primitive
  // array type sidesteps its type-reference resolution entirely.
  @ApiProperty({ type: [String] })
  podcasts!: never[];

  /**
   * Reserved for a future domain; always empty.
   * @example []
   */
  @ApiProperty({ type: [String] })
  boardGames!: never[];

  /** Notifications received. */
  notifications!: DataExportNotificationResponseDto[];

  /** Reviews and ratings written. */
  reviews!: DataExportReviewResponseDto[];

  /** Votes on other reviews. */
  reviewVotes!: DataExportReviewVoteResponseDto[];

  /** Comments posted. */
  comments!: DataExportCommentResponseDto[];

  /** Reactions to comments. */
  commentReactions!: DataExportCommentReactionResponseDto[];

  /** Lists owned. */
  lists!: DataExportListResponseDto[];

  /** Lists the account can edit without owning them. */
  listMemberships!: DataExportListMembershipResponseDto[];

  /** Follows, both ways. */
  follows!: DataExportFollowsResponseDto;

  /** Accounts blocked. */
  blocks!: DataExportBlocksResponseDto;

  /** Reports filed. */
  reports!: DataExportReportResponseDto[];

  /** Moderation decisions taken about the account's content. */
  moderationDecisions!: DataExportModerationDecisionResponseDto[];

  /** The account's security log. */
  securityEvents!: DataExportSecurityEventResponseDto[];

  /** Devices signed in from. */
  devices!: DataExportDeviceResponseDto[];

  /** Who sees what, per domain. */
  visibilitySettings!: DataExportVisibilitySettingResponseDto[];

  /** The account's plan. */
  entitlement!: DataExportEntitlementResponseDto;

  /** Paid subscriptions, if any. */
  subscriptions!: DataExportSubscriptionResponseDto[];

  /** Yearly reading goals. */
  readingGoals!: DataExportReadingGoalResponseDto[];

  /** Imports run. */
  importRuns!: DataExportImportRunResponseDto[];

  /** Saved library views. */
  savedViews!: SavedViewResponseDto[];
}
