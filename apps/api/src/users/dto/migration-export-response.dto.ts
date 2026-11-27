import type {
  MigrationExportDto,
  MigrationExportFileDto,
} from "@loomkeep/shared/contracts";

class MigrationExportFileResponseDto implements MigrationExportFileDto {
  name!: string;
  csv!: string;
}

export class MigrationExportResponseDto implements MigrationExportDto {
  files!: MigrationExportFileResponseDto[];
}
