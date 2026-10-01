import type {
  ApiV1ListDetailDto,
  ApiV1ListDto,
  ListDto,
  Locale,
} from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
import { ListService } from "../../lists/list.service";
import { isSocialEnabled } from "../../social/social.config";
import { webOriginOf } from "./library-v1.service";
import { toTarget } from "./mappers";
import { WorkTitlesService } from "./work-titles.service";

/**
 * The caller's own lists, plus the ones shared with them as an editor —
 * sharing is a social feature, so those drop out when social is off.
 */
@Injectable()
export class ListsV1Service {
  private readonly webOrigin: string;

  constructor(
    private readonly config: ConfigService,
    private readonly lists: ListService,
    private readonly titles: WorkTitlesService,
  ) {
    this.webOrigin = webOriginOf(config);
  }

  async list(userId: string): Promise<ApiV1ListDto[]> {
    const social = isSocialEnabled(this.config);
    const lists = await this.lists.listEditable(userId);
    return lists
      .filter((list) => social || list.role === "OWNER")
      .map((list) => toList(list, list.role, list.itemCount));
  }

  async get(
    userId: string,
    id: string,
    lang: Locale | undefined,
  ): Promise<ApiV1ListDetailDto> {
    const list = await this.lists.getEditable(userId, id);
    const role = list.viewerRole;

    if (
      (role !== "OWNER" && role !== "EDITOR") ||
      (role === "EDITOR" && !isSocialEnabled(this.config))
    ) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListNotFound);
    }

    const items = list.items.map((item) => ({
      id: item.id,
      position: item.position,
      addedAt: item.addedAt,
      target: toTarget(
        item.targetType,
        item.targetId,
        item.target,
        this.webOrigin,
      ),
    }));
    await this.titles.translateTargets(
      await this.titles.languageFor(userId, lang),
      items.map((item) => item.target),
    );
    return { ...toList(list, role, list.items.length), items };
  }
}

function toList(
  list: ListDto,
  role: "OWNER" | "EDITOR",
  itemCount: number,
): ApiV1ListDto {
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    kind: list.kind,
    visibility: list.visibility,
    role,
    itemCount,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}
