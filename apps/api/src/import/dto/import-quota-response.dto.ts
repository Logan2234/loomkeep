import type { ImportQuotaDto } from "@loomkeep/shared";

export class ImportQuotaResponseDto implements ImportQuotaDto {
  MEDIA?: boolean;
  BOOKS?: boolean;
  GAMES?: boolean;
  MUSIC?: boolean;
  PODCASTS?: boolean;
  BOARDGAMES?: boolean;
}
