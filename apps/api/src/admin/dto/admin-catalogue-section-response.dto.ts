import type {
  AdminCacheDomainRowDto,
  AdminCatalogueSectionDto,
  AdminPopularWorkDto,
  StatsDomain,
} from "@loomkeep/shared";
import { TrendPointResponseDto } from "./trend-point-response.dto";

class AdminCacheDomainRowResponseDto implements AdminCacheDomainRowDto {
  domain!: StatsDomain;
  items!: number;
  stalePercent!: number | null;
  growth!: TrendPointResponseDto[];
}

class AdminPopularWorkResponseDto implements AdminPopularWorkDto {
  domain!: StatsDomain;
  title!: string;
  entries!: number;
}

export class AdminCatalogueSectionResponseDto implements AdminCatalogueSectionDto {
  generatedAt!: string;
  byDomain!: AdminCacheDomainRowResponseDto[];
  popular!: AdminPopularWorkResponseDto[];
  sharedPercent!: number;
  orphanCount!: number;
}
