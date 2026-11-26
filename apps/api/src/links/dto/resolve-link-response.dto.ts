import type { Domain } from "@loomkeep/shared";
import type { ResolvedLinkDto, ResolveLinkResultDto } from "../link.types";

export class ResolvedLinkResponseDto implements ResolvedLinkDto {
  domain!: Domain | null;
  href!: string;
}

export class ResolveLinkResultResponseDto implements ResolveLinkResultDto {
  match!: ResolvedLinkResponseDto | null;
}
