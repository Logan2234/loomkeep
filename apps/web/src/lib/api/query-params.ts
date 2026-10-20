export function pageParam(page: number | undefined): string | undefined {
  return page !== undefined && page > 1 ? String(page) : undefined;
}

export function limitParam(limit: number | undefined): string | undefined {
  return limit ? String(limit) : undefined;
}
