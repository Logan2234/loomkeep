import type { MovieReleaseInfo } from "@loomkeep/shared";

export class MovieReleaseResponseDto implements MovieReleaseInfo {
  upcoming!: boolean;
  publicDate!: string | null;
  localDate!: string | null;
  localType!: "cinema" | "digital" | null;
  region!: string;
}
