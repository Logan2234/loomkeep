import type { StatsDomain, StatsWorkDto } from "@loomkeep/shared";

export class StatsWorkResponseDto implements StatsWorkDto {
  domain!: StatsDomain;
  title!: string;
  imageUrl!: string | null;
  rating!: number | null;
  href!: string;
}
