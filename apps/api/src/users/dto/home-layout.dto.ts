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
  /**
   * An app screen (`app`, with `id`) or any web address (`url`, with `url`
   * and `label`).
   * @example "app"
   */
  @IsIn(["app", "url"])
  kind!: "app" | "url";

  /**
   * A web navigation id, for `app`; unknown ones are dropped when shown.
   * @example "calendar"
   */
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "app")
  @Matches(/^[a-z-]{1,32}$/)
  id?: string;

  /**
   * An http(s) address, for `url`: it becomes a link on the home page.
   * @example "https://feedback.loomkeep.app"
   */
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(HOME_LAYOUT_LIMITS.urlLength)
  url?: string;

  /**
   * The link's label, for `url`.
   * @example "Feedback"
   */
  @ValidateIf((link: HomeQuickLinkBody) => link.kind === "url")
  @IsString()
  @MinLength(1)
  @MaxLength(HOME_LAYOUT_LIMITS.labelLength)
  label?: string;
}

class HomeWidgetConfigBody {
  /** Quick links, for the quick links widget. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.quickLinks)
  @ValidateNested({ each: true })
  @Type(() => HomeQuickLinkBody)
  links?: HomeQuickLinkBody[];

  /**
   * The list shown, for the list widget.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  listId?: string;

  /**
   * The saved view shown, for the saved view widget.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  viewId?: string;

  /**
   * The note's text, for the note widget.
   * @example "Finish The Expanse before December"
   */
  @IsOptional()
  @IsString()
  @MaxLength(HOME_LAYOUT_LIMITS.noteLength)
  text?: string;

  /**
   * Domains the widget covers.
   * @example ["MEDIA", "BOOKS"]
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(DomainValues).length)
  @IsIn(Object.values(DomainValues), { each: true })
  domains?: Domain[];

  /**
   * Video types the widget covers.
   * @example ["SERIES", "ANIME"]
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(MediaType).length)
  @IsIn(Object.values(MediaType), { each: true })
  mediaTypes?: MediaType[];

  /**
   * Leaderboard among everyone (`global`) or friends.
   * @example "friends"
   */
  @IsOptional()
  @IsIn(["global", "friends"])
  scope?: LeaderboardScope;

  /**
   * Leaderboard period.
   * @example "month"
   */
  @IsOptional()
  @IsIn(["month", "year", "all"])
  period?: LeaderboardPeriod;

  /**
   * Order of the works shown.
   * @example "recent"
   */
  @IsOptional()
  @IsIn(HOME_WIDGET_SORTS)
  sort?: HomeWidgetSort;

  /**
   * Only the account's own lists.
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  ownOnly?: boolean;
}

class HomeWidgetBody {
  /**
   * The widget's id within the layout.
   * @example "w-3"
   */
  @Matches(/^[\w-]{1,36}$/)
  id!: string;

  /**
   * The kind of widget.
   * @example "toWatch"
   */
  @IsIn(HOME_WIDGET_TYPES)
  type!: HomeWidgetType;

  /**
   * Column, from 0.
   * @example 0
   */
  @IsInt()
  @Min(0)
  @Max(HOME_GRID_COLUMNS - 1)
  x!: number;

  /**
   * Row, from 0.
   * @example 2
   */
  @IsInt()
  @Min(0)
  @Max(HOME_LAYOUT_LIMITS.maxRow)
  y!: number;

  /**
   * Width, in columns.
   * @example 2
   */
  @IsInt()
  @Min(1)
  @Max(HOME_GRID_COLUMNS)
  w!: number;

  /**
   * Height, in rows.
   * @example 1
   */
  @IsInt()
  @Min(1)
  @Max(HOME_LAYOUT_LIMITS.maxHeight)
  h!: number;

  /** Settings of that kind of widget. */
  @IsOptional()
  @ValidateNested()
  @Type(() => HomeWidgetConfigBody)
  config?: HomeWidgetConfigBody;
}

// Each kind's size bounds live on the web, which clamps at render time; the
// API only keeps a layout inside the grid.
// An empty page isn't a layout: going back to the default is DELETE.
export class HomeLayoutBody implements HomeLayoutDto {
  /** The widgets, each with its place on the grid. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HOME_LAYOUT_LIMITS.widgets)
  @ValidateNested({ each: true })
  @Type(() => HomeWidgetBody)
  widgets!: HomeWidgetBody[];
}
