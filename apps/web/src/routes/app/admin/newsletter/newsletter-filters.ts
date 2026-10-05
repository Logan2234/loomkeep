import { foldAdminSearch } from "#lib/admin-search.js";
import { localDayBoundary } from "#lib/admin-user-filters.js";

export function filterNewsletterSends<
  T extends { title: string; sentAt: string },
>(sends: T[], filters: { query: string; from: string; to: string }): T[] {
  const query = foldAdminSearch(filters.query).trim();
  const from = localDayBoundary(filters.from);
  const to = localDayBoundary(filters.to, true);
  return sends.filter((send) => {
    const time = new Date(send.sentAt).getTime();
    return (
      foldAdminSearch(send.title).includes(query) &&
      (!from || time >= new Date(from).getTime()) &&
      (!to || time < new Date(to).getTime())
    );
  });
}
