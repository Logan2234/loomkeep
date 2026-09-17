import type {
  Domain,
  ImportLastRunDto,
  ImportRunDto,
  ImportSource,
} from "@loomkeep/shared";

export class ImportRunResponseDto implements ImportRunDto {
  sourceId!: ImportSource;
  domain!: Domain | null;
  status!: string;
  itemCount!: number;
  summary!: string | null;
  finishedAt!: string;
}

export class ImportLastRunResponseDto implements ImportLastRunDto {
  run!: ImportRunResponseDto | null;
}
