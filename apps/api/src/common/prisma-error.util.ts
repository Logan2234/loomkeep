import { Prisma } from "@prisma/client";

/**
 * Whether an error is Prisma's unique-constraint violation (P2002).
 *
 * Worth a named helper rather than an inline check: the interesting cases are
 * all "someone else got there first", where the right move is to adopt their
 * row or report a conflict — never to let it surface as an unhandled 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}
