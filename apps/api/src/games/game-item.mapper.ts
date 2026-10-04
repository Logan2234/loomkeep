import type { GameItemDto } from "@loomkeep/shared";
import type { GameExternalId, GameItem } from "@prisma/client";
import { canonicalExternalId } from "../common/external-id.util";
import { isGameItemUpcoming } from "./game-release.util";

export function toGameItemDto(
  game: GameItem & { externalIds: GameExternalId[] },
): GameItemDto {
  return {
    id: game.id,
    title: game.title,
    coverUrl: game.coverUrl,
    canonicalSource: game.canonicalSource,
    sourceId: canonicalExternalId(game, game.externalIds),
    ...(isGameItemUpcoming(game) ? { upcoming: true } : {}),
  };
}
