import type { GameStatus } from "@loomkeep/shared";
import { GameOwnershipStatus } from "@loomkeep/shared";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * The write a Steam import makes to GameEntry, kept here beside the games
 * module that owns the table. No side effect runs: an import earns its XP
 * once, at the end (ImportJobService).
 */
export class GameEntryImportWriter {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A game from the user's Steam library. A new entry is, by definition,
   * owned digitally on Steam. A reimport only refreshes Steam's own counter:
   * the user's Loomkeep status, notes, dates, ownership and sessions survive.
   */
  async syncSteamGame(
    userId: string,
    gameItemId: string,
    game: { status: GameStatus; playtimeMinutes: number; syncedAt: Date },
  ): Promise<void> {
    await this.prisma.gameEntry.upsert({
      where: { userId_gameItemId: { userId, gameItemId } },
      update: {
        playtimeMinutes: game.playtimeMinutes,
        steamPlaytimeMinutes: game.playtimeMinutes,
        steamSyncedAt: game.syncedAt,
      },
      create: {
        userId,
        gameItemId,
        status: game.status,
        playtimeMinutes: game.playtimeMinutes,
        steamPlaytimeMinutes: game.playtimeMinutes,
        steamSyncedAt: game.syncedAt,
        ownershipStatus: GameOwnershipStatus.DIGITAL,
        ownershipSource: "Steam",
      },
    });
  }
}
