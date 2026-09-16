// WebSocket event names, shared between the API's EventsGateway (emitter)
// and the web client's realtime socket (listener). Payloads are kept minimal
// on purpose: most events are pure "something changed" signals the client
// resolves with its own invalidateQueries — the exception is import progress,
// frequent enough that resending the full state avoids an HTTP round trip per
// tick (see the client's setQueryData usage).

export const RealtimeEvent = {
  NOTIFICATION: "notification",
  REPORTS_COUNT: "reports-count",
  ACHIEVEMENT_UNLOCKED: "achievement-unlocked",
  IMPORT_PROGRESS: "import-progress",
  COMMENT_CHANGED: "comment-changed",
  LIST_UPDATED: "list-updated",
  ONBOARDING_UPDATED: "onboarding-updated",
  FOLLOW_REQUEST_CHANGED: "follow-request-changed",
} as const;
export type RealtimeEvent = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface ImportProgressEvent {
  done: number;
  total: number;
  status: "running" | "completed" | "failed";
}
