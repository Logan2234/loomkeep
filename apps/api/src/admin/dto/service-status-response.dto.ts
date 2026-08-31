import type {
  QuotaWindow,
  ServiceArea,
  ServiceStatusDto,
  ServiceStatusResponseDto,
} from "@loomkeep/shared";

class ServiceStatusLimitResponseDto {
  max!: number;
  window!: QuotaWindow;
}

class ServiceStatusItemResponseDto implements ServiceStatusDto {
  key!: string;
  label!: string;
  area!: ServiceArea;
  required!: boolean;
  configured!: boolean;
  reachable!: boolean | null;
  detail?: string;
  latencyMs?: number;
  keyUrl?: string;
  today?: number;
  thisMonth?: number;
  limit?: ServiceStatusLimitResponseDto;
  percentUsed?: number;
  comingSoon?: boolean;
}

export class ServiceStatusListResponseDto implements ServiceStatusResponseDto {
  services!: ServiceStatusItemResponseDto[];
  checkedAt!: string;
}
