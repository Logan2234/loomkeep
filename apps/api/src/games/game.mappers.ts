import type { GamePlaythroughDto } from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";

export function toPlaythroughDto(
  playthrough: Prisma.GamePlaythroughGetPayload<{
    select: {
      id: true;
      number: true;
      status: true;
      startedAt: true;
      finishedAt: true;
      trackedMinutes: true;
      legacyIncomplete: true;
      _count: { select: { sessions: true } };
    };
  }>,
): GamePlaythroughDto {
  return {
    id: playthrough.id,
    number: playthrough.number,
    status: playthrough.status,
    startedAt: playthrough.startedAt?.toISOString() ?? null,
    finishedAt: playthrough.finishedAt?.toISOString() ?? null,
    sessionCount: playthrough._count.sessions,
    trackedMinutes: playthrough.trackedMinutes,
    legacyIncomplete: playthrough.legacyIncomplete,
  };
}
