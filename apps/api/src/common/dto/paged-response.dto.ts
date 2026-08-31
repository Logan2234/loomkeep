import type { PagedResult } from "@loomkeep/shared";
import type { Type } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Nest's swagger plugin can't infer a schema from a generic class (no
 * runtime metadata for `T`), so a `PagedResult<T>` response needs one
 * concrete class per item type — built at call time by this factory rather
 * than hand-written per domain. See https://docs.nestjs.com/openapi/mapped-types#generics
 */
export function PagedResponseDto<T>(itemType: Type<T>): Type<PagedResult<T>> {
  class PagedResponseDtoClass {
    @ApiProperty({ type: itemType, isArray: true })
    items!: T[];

    @ApiProperty()
    hasMore!: boolean;

    @ApiProperty({ required: false })
    total?: number;
  }

  Object.defineProperty(PagedResponseDtoClass, "name", {
    value: `PagedResponse${itemType.name}`,
  });

  return PagedResponseDtoClass as Type<PagedResult<T>>;
}
