import type {
  AdminReportCategoryCountDto,
  AdminSocialStatsDto,
  AdminTopContributorDto,
  ReportCategory,
} from "@loomkeep/shared";
import { RatingBucketResponseDto } from "../../stats/dto/rating-bucket-response.dto";
import { AdminSocialActivityTrendResponseDto } from "./admin-social-activity-trend-response.dto";

class AdminSocialTotalsResponseDto {
  reviews!: number;
  comments!: number;
  lists!: number;
  follows!: number;
  reactions!: number;
  helpfulVotes!: number;
  blocks!: number;
  deletedCommentPercent!: number;
}

class AdminReportCategoryCountResponseDto implements AdminReportCategoryCountDto {
  category!: ReportCategory;
  count!: number;
}

class AdminReportsStatsResponseDto {
  pending!: number;
  resolved!: number;
  medianResolutionHours!: number | null;
  foundedPercent!: number | null;
  byCategory!: AdminReportCategoryCountResponseDto[];
}

class AdminTopContributorResponseDto implements AdminTopContributorDto {
  username!: string;
  contributions!: number;
}

class AdminInstanceRatingsResponseDto {
  distribution!: RatingBucketResponseDto[];
  average!: number | null;
  total!: number;
}

export class AdminSocialStatsResponseDto implements AdminSocialStatsDto {
  generatedAt!: string;
  totals!: AdminSocialTotalsResponseDto;
  activity!: AdminSocialActivityTrendResponseDto;
  reports!: AdminReportsStatsResponseDto;
  ratings!: AdminInstanceRatingsResponseDto;
  topContributors!: AdminTopContributorResponseDto[];
  contributors!: number;
  readers!: number;
}
