import {
  BookStatus,
  EntryStatus,
  ErrorCode,
  GameStatus,
  MusicStatus,
  SAVED_VIEW_LIMITS,
  type CreateSavedViewDto,
  type SavedViewDomain,
  type SavedViewDto,
  type SavedViewFiltersDto,
  type UpdateSavedViewDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma, SavedView } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { EntitlementService } from "../entitlements/entitlement.service";
import { PrismaService } from "../prisma/prisma.service";

/** The statuses each library filters on — media adds its derived DORMANT. */
const STATUSES: Record<SavedViewDomain, readonly string[]> = {
  MEDIA: [...Object.values(EntryStatus), "DORMANT"],
  GAMES: Object.values(GameStatus),
  BOOKS: Object.values(BookStatus),
  MUSIC: Object.values(MusicStatus),
};

/**
 * Keeps only what the domain's list understands, so that applying a view
 * never sends a status its list can't filter on.
 */
function understoodFilters(
  domain: SavedViewDomain,
  filters: SavedViewFiltersDto,
): Prisma.InputJsonValue {
  const understood: SavedViewFiltersDto = {
    ...filters,
    statuses: filters.statuses?.filter((s) => STATUSES[domain].includes(s)),
    types: domain === "MEDIA" ? filters.types : undefined,
  };
  return understood as Prisma.InputJsonValue;
}

function toDto(row: SavedView): SavedViewDto {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain as SavedViewDomain,
    filters: row.filters as SavedViewFiltersDto,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SavedViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async list(userId: string): Promise<SavedViewDto[]> {
    const rows = await this.prisma.savedView.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toDto);
  }

  async create(
    userId: string,
    body: CreateSavedViewDto,
  ): Promise<SavedViewDto> {
    await this.assertRoomForOneMore(userId);
    const row = await this.prisma.savedView.create({
      data: {
        userId,
        name: body.name.trim(),
        domain: body.domain,
        filters: understoodFilters(body.domain, body.filters),
      },
    });
    return toDto(row);
  }

  async update(
    userId: string,
    id: string,
    body: UpdateSavedViewDto,
  ): Promise<SavedViewDto> {
    const view = await this.findOwn(userId, id);
    const row = await this.prisma.savedView.update({
      where: { id: view.id },
      data: {
        name: body.name?.trim(),
        filters: body.filters
          ? understoodFilters(view.domain as SavedViewDomain, body.filters)
          : undefined,
      },
    });
    return toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const view = await this.findOwn(userId, id);
    await this.prisma.savedView.delete({ where: { id: view.id } });
  }

  /** Someone else's view is a 404 too: its id says nothing about it. */
  private async findOwn(userId: string, id: string): Promise<SavedView> {
    const view = await this.prisma.savedView.findFirst({
      where: { id, userId },
    });

    if (!view) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibrarySavedViewNotFound,
      );
    }

    return view;
  }

  /**
   * A free account keeps `SAVED_VIEW_LIMITS.free` views, any account `max`.
   * The free quota is a no-op while the `premium-features` flag is off (see
   * `EntitlementService#isEffectivelyPremium`).
   */
  private async assertRoomForOneMore(userId: string): Promise<void> {
    const count = await this.prisma.savedView.count({ where: { userId } });

    if (count >= SAVED_VIEW_LIMITS.max) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibrarySavedViewLimitReached,
      );
    }

    if (
      count >= SAVED_VIEW_LIMITS.free &&
      !(await this.entitlements.isEffectivelyPremium(userId))
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.LibrarySavedViewFreeQuotaExceeded,
      );
    }
  }
}
