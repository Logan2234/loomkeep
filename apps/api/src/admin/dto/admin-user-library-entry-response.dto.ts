import type { AdminUserLibraryEntryDto } from "@loomkeep/shared";

export class AdminUserLibraryEntryResponseDto implements AdminUserLibraryEntryDto {
  id!: string;
  title!: string;
  imageUrl!: string | null;
  href!: string | null;
  status!: string;
  favorite!: boolean;
  addedAt!: string;
}
