import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { imageKey } from "./adult-images.util";

const TTL_MS = 5 * 60 * 1000;

/** The keys of every stored 18+ work's images, reloaded every few minutes. */
@Injectable()
export class AdultImageKeysService {
  private keys: Promise<Set<string>> | null = null;
  private loadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  get(): Promise<Set<string>> {
    if (!this.keys || Date.now() - this.loadedAt > TTL_MS) {
      this.loadedAt = Date.now();
      this.keys = this.load().catch((error: unknown) => {
        this.keys = null;
        throw error;
      });
    }

    return this.keys;
  }

  private async load(): Promise<Set<string>> {
    const where = { isAdult: true };
    const [media, games, sagaMedia, sagaGames] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where,
        select: { posterUrl: true, backdropUrl: true },
      }),
      this.prisma.gameItem.findMany({
        where,
        select: { coverUrl: true, backdropUrl: true },
      }),
      this.prisma.sagaMember.findMany({ where, select: { posterUrl: true } }),
      this.prisma.gameSagaMember.findMany({
        where,
        select: { coverUrl: true },
      }),
    ]);

    const urls = [...media, ...games, ...sagaMedia, ...sagaGames].flatMap(
      (row) => Object.values(row),
    );
    return new Set(
      urls.filter((url): url is string => !!url).map((url) => imageKey(url)),
    );
  }
}
