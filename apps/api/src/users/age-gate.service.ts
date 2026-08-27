import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import { isAdult } from "./age.util";

/** Whether a user may see 18+ titles: opted in AND actually 18+. */
@Injectable()
export class AgeGateService {
  constructor(private readonly prisma: PrismaService) {}

  async allowsAdultContent(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthDate: true, allowAdultContent: true },
    });
    return !!user?.allowAdultContent && isAdult(user.birthDate);
  }

  /**
   * Blocks 18+ titles for accounts that haven't opted in (or aren't 18+).
   * Takes the already-resolved `allowsAdult` flag so callers that also need it
   * for other filtering don't pay a second `allowsAdultContent` query.
   */
  assertAdultAllowed(isAdultTitle: boolean, allowsAdult: boolean): void {
    if (isAdultTitle && !allowsAdult) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserAdultContentDisabled,
        undefined,
        "This title is restricted to accounts with adult content enabled",
      );
    }
  }
}
