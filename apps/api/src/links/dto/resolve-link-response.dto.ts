import type {
  Domain,
  ResolvedLinkDto,
  ResolveLinkResultDto,
} from "@loomkeep/shared";

export class ResolvedLinkResponseDto implements ResolvedLinkDto {
  domain!: Domain | null;
  href!: string;
}

export class ResolveLinkResultResponseDto implements ResolveLinkResultDto {
  match!: ResolvedLinkResponseDto | null;
}
