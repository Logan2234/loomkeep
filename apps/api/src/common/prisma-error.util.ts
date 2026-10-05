import { Prisma } from "@prisma/client";

/**
 * Whether an error is Prisma's unique-constraint violation (P2002).
 *
 * Worth a named helper rather than an inline check: the interesting cases are
 * all "someone else got there first", where the right move is to adopt their
 * row or report a conflict — never to let it surface as an unhandled 500.
 */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }

  if (field === undefined) return true;
  const target = err.meta?.target;
  return (
    (Array.isArray(target) || typeof target === "string") &&
    target.includes(field)
  );
}
