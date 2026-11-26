import type { CsvExportDto } from "../../account/data-export.types";

export class CsvExportResponseDto implements CsvExportDto {
  csv!: string;
}
