import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Single source of truth for the "is there a block between these two users?"
 * question — reused everywhere blocks gate a read or a notification, so the
 * directional semantics stay consistent instead of being reimplemented ad hoc.
 */
@Injectable()
export class BlockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether `blockerId` has specifically blocked `blockedId`. */
  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    return block !== null;
  }

  /** Whether a block exists between the two users, in either direction. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return block !== null;
  }

  /** The block rows between two users, so a caller can tell who blocked whom. */
  async findBlocksBetween(a: string, b: string) {
    return this.prisma.block.findMany({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
  }
}
