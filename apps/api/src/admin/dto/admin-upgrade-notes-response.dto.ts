import type {
  AdminUpgradeNoteDto,
  AdminUpgradeNotesDto,
} from "@loomkeep/shared";

export class AdminUpgradeNoteResponseDto implements AdminUpgradeNoteDto {
  version!: string;
  items!: string[];
}

export class AdminUpgradeNotesResponseDto implements AdminUpgradeNotesDto {
  versions!: AdminUpgradeNoteResponseDto[];
}
