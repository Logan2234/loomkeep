import type { ProfileAccess, SocialProfileDto } from "@loomkeep/shared";
import { ProfileActivityStatsResponseDto } from "./profile-activity-stats-response.dto";
import { ProfileDomainStatResponseDto } from "./profile-domain-stat-response.dto";
import { RelationshipResponseDto } from "./relationship-response.dto";

export class SocialProfileResponseDto implements SocialProfileDto {
  id!: string;
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
  bio!: string | null;
  profileAccess!: ProfileAccess;
  createdAt!: string;
  followerCount!: number;
  followingCount!: number;
  relationship!: RelationshipResponseDto;
  domains!: ProfileDomainStatResponseDto[];
  activityStats!: ProfileActivityStatsResponseDto;
  reviewsCount!: number;
  commentsCount!: number;
  listsCount!: number;
  locked!: boolean;
}
