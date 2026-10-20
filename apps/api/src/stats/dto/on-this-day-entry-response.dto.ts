import type {
  OnThisDayEntryDto,
  OnThisDayKind,
  StatsDomain,
} from "@loomkeep/shared";

export class OnThisDayEntryResponseDto implements OnThisDayEntryDto {
  domain!: StatsDomain;
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
  kind!: OnThisDayKind;
  date!: string;
  count!: number;
}
