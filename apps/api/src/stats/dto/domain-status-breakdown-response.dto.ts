import type { DomainStatusBreakdownDto, StatsDomain } from "@loomkeep/shared";
import { StatusBucketCountResponseDto } from "./status-bucket-count-response.dto";

export class DomainStatusBreakdownResponseDto implements DomainStatusBreakdownDto {
  domain!: StatsDomain;
  total!: number;
  favorites!: number;
  byStatus!: StatusBucketCountResponseDto[];
}
