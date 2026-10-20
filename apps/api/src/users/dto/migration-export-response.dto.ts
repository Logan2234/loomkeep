import type {
  MigrationExportDto,
  MigrationExportFileDto,
} from "@loomkeep/shared";

class MigrationExportFileResponseDto implements MigrationExportFileDto {
  name!: string;
  csv!: string;
}

export class MigrationExportResponseDto implements MigrationExportDto {
  files!: MigrationExportFileResponseDto[];
}
