import type {
  ImportItemContext,
  ImportPlanItem,
} from "@loomkeep/shared/contracts";
import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { IMPORT_ITEM_CONTEXT_MODELS } from "./import-item-context-response.dto";
import { ImportMatchResponseDto } from "./import-match-response.dto";

@ApiExtraModels(...IMPORT_ITEM_CONTEXT_MODELS)
export class ImportPlanItemResponseDto implements ImportPlanItem {
  key!: string;
  title!: string;
  sourceTitle!: string;
  @ApiProperty({
    oneOf: IMPORT_ITEM_CONTEXT_MODELS.map((model) => ({
      $ref: getSchemaPath(model),
    })),
  })
  context!: ImportItemContext;

  coverUrl!: string | null;
  match!: ImportMatchResponseDto | null;
  include!: boolean;
  alreadyInLibrary!: boolean;
  defaultStatus!: string | null;
  apiError?: boolean;
}
