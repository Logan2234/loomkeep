import type {
  AdminUpgradeNoteDto,
  AdminUpgradeNotesDto,
} from "@loomkeep/shared/contracts";

export class AdminUpgradeNoteResponseDto implements AdminUpgradeNoteDto {
  version!: string;
  items!: string[];
}

export class AdminUpgradeNotesResponseDto implements AdminUpgradeNotesDto {
  versions!: AdminUpgradeNoteResponseDto[];
}
