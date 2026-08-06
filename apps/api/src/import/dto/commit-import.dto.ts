import type {
  ImportCommitOverride,
  ImportCommitRequest,
} from "@loomkeep/shared";
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class CommitImportDto implements ImportCommitRequest {
  @IsArray()
  @IsString({ each: true })
  include!: string[];

  // Free-form map (key → chosen status); its inner shape is read defensively.
  @IsOptional()
  @IsObject()
  statuses?: Record<string, string>;

  // Free-form map (key → chosen match); its inner shape is read defensively.
  @IsOptional()
  @IsObject()
  overrides?: Record<string, ImportCommitOverride>;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
