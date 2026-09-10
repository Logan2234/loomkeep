import type { BookEditionDto } from "@loomkeep/shared";

export class BookEditionResponseDto implements BookEditionDto {
  key!: string;
  title!: string;
  language!: string | null;
  coverUrl!: string | null;
}
