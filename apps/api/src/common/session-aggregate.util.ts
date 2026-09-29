interface DurationSession {
  durationMinutes: number;
}

interface ReadingSession extends DurationSession {
  pagesRead: number;
  startPage: number | null;
  endPage: number | null;
}

export function gameSessionAggregate(sessions: DurationSession[]): {
  trackedMinutes: number;
} {
  return {
    trackedMinutes: sessions.reduce(
      (total, session) => total + session.durationMinutes,
      0,
    ),
  };
}

export function bookSessionAggregate(
  baselinePage: number,
  referencePageCount: number | null,
  sessions: ReadingSession[],
): {
  currentPage: number;
  pagesRead: number;
  trackedMinutes: number;
  completionSuggested: boolean;
} {
  let currentPage = baselinePage;
  let pagesRead = 0;
  let trackedMinutes = 0;

  for (const session of sessions) {
    pagesRead += session.pagesRead;
    trackedMinutes += session.durationMinutes;

    if (session.startPage === null || session.endPage === null) {
      currentPage += session.pagesRead;
    } else {
      currentPage = Math.max(currentPage, session.endPage);
    }
  }

  currentPage =
    referencePageCount === null
      ? currentPage
      : Math.min(currentPage, referencePageCount);

  return {
    currentPage,
    pagesRead,
    trackedMinutes,
    completionSuggested:
      referencePageCount !== null && currentPage >= referencePageCount,
  };
}
