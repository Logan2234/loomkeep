import type { CsvExportDto } from "@loomkeep/shared";

export class CsvExportResponseDto implements CsvExportDto {
  csv!: string;
}
