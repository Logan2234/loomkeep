import type {
  Domain,
  ResolvedLinkDto,
  ResolveLinkResultDto,
} from "@loomkeep/shared";

export class ResolvedLinkResponseDto implements ResolvedLinkDto {
  domain!: Domain;
  href!: string;
}

export class ResolveLinkResultResponseDto implements ResolveLinkResultDto {
  match!: ResolvedLinkResponseDto | null;
}
