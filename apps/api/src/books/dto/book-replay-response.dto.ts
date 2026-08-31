import type { BookReplayDto } from "@loomkeep/shared";

export class BookReplayResponseDto implements BookReplayDto {
  id!: string;
  finishedAt!: string;
}
