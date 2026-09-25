import type {
  Domain,
  HomeLayoutDto,
  HomeWidgetSort,
  HomeWidgetType,
  LeaderboardPeriod,
  LeaderboardScope,
} from "@loomkeep/shared";
import {
  Domain as DomainValues,
  HOME_GRID_COLUMNS,
  HOME_LAYOUT_LIMITS,
  HOME_WIDGET_SORTS,
  HOME_WIDGET_TYPES,
  MediaType,
} from "@loomkeep/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class HomeQuickLinkBody {
  @IsIn(["app", "url"])
  kind!: "app" | "url";

  // A web navigation id; unknown ones are dropped at render time, like the
  // mobile bottom-bar shortcuts.
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "app")
  @Matches(/^[a-z-]{1,32}$/)
  id?: string;

  // http(s) only: the address ends up as an href on the user's home page.
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(HOME_LAYOUT_LIMITS.urlLength)
  url?: string;

  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsString()
  @MinLength(1)
  @MaxLength(HOME_LAYOUT_LIMITS.labelLength)
  label?: string;
}

class HomeWidgetConfigBody {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.quickLinks)
  @ValidateNested({ each: true })
  @Type(() => HomeQuickLinkBody)
  links?: HomeQuickLinkBody[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  listId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(HOME_LAYOUT_LIMITS.noteLength)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(DomainValues).length)
  @IsIn(Object.values(DomainValues), { each: true })
  domains?: Domain[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(MediaType).length)
  @IsIn(Object.values(MediaType), { each: true })
  mediaTypes?: MediaType[];

  @IsOptional()
  @IsIn(["global", "friends"])
  scope?: LeaderboardScope;

  @IsOptional()
  @IsIn(["month", "year", "all"])
  period?: LeaderboardPeriod;

  @IsOptional()
  @IsIn(HOME_WIDGET_SORTS)
  sort?: HomeWidgetSort;

  @IsOptional()
  @IsBoolean()
  ownOnly?: boolean;
}

class HomeWidgetBody {
  @Matches(/^[\w-]{1,36}$/)
  id!: string;

  @IsIn(HOME_WIDGET_TYPES)
  type!: HomeWidgetType;

  @IsInt()
  @Min(0)
  @Max(HOME_GRID_COLUMNS - 1)
  x!: number;

  @IsInt()
  @Min(0)
  @Max(HOME_LAYOUT_LIMITS.maxRow)
  y!: number;

  @IsInt()
  @Min(1)
  @Max(HOME_GRID_COLUMNS)
  w!: number;

  @IsInt()
  @Min(1)
  @Max(HOME_LAYOUT_LIMITS.maxHeight)
  h!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomeWidgetConfigBody)
  config?: HomeWidgetConfigBody;
}

// Each kind's size bounds live on the web, which clamps at render time; the
// API only keeps a layout inside the grid.
// An empty page isn't a layout: going back to the default is DELETE.
export class HomeLayoutBody implements HomeLayoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.widgets)
  @ValidateNested({ each: true })
  @Type(() => HomeWidgetBody)
  widgets!: HomeWidgetBody[];
}
