import { ALERTS, type AlertKey } from "@loomkeep/shared";
import {
  NotificationAction,
  type PushAction,
} from "../notifications/notification-action";
import type { NotificationCopy } from "../notifications/notification-copy";
import type { PushPayload } from "../notifications/push.service";

type Sample = Omit<PushPayload, "group" | "actions"> & {
  /** The real push's buttons, by label: the sample's do nothing. */
  buttons?: (keyof NotificationCopy["pushActions"])[];
};

const ACTOR = "Alice";
const WORK = "Severance";
const WORK_URL = "/app/media/tv/95396";
const LIST = "Weekend";

/**
 * Each alert's push as an account would get it (Admin › Communications),
 * built from the same copy as the real one, with stand-in names. Its
 * buttons carry the real labels but the TEST action: pressing one checks
 * the whole way to the API without accepting a request or sending a
 * message for real.
 */
const SAMPLES: Partial<Record<AlertKey, (copy: NotificationCopy) => Sample>> = {
  COMMENT_REPLY: (copy) => ({
    title: copy.pushTitle.commentReply(ACTOR),
    body: `${WORK} 🔥`,
    url: WORK_URL,
    buttons: ["reply", "markRead"],
  }),
  COMMENT_MENTION: (copy) => ({
    title: copy.pushTitle.commentMention(ACTOR),
    body: `${WORK} 🔥`,
    url: WORK_URL,
    buttons: ["reply", "markRead"],
  }),
  FOLLOW_REQUEST: (copy) => ({
    title: ACTOR,
    body: copy.follow.requested,
    url: "/app",
    buttons: ["accept", "reject"],
  }),
  FOLLOW: (copy) => ({
    title: ACTOR,
    body: copy.follow.followed,
    url: "/app",
    buttons: ["followBack"],
  }),
  FOLLOW_ACCEPTED: (copy) => ({
    title: ACTOR,
    body: copy.follow.accepted,
    url: "/app",
    buttons: ["markRead"],
  }),
  LIST_MEMBER_ADDED: (copy) => ({
    title: ACTOR,
    body: copy.listEditorAdded(LIST),
    url: "/app/lists",
    buttons: ["markRead"],
  }),
  LIST_ITEM_ADDED: (copy) => ({
    title: ACTOR,
    body: copy.listItemAdded(WORK, LIST),
    url: "/app/lists",
    buttons: ["markRead"],
  }),
  INVITATION_ACCEPTED: (copy) => ({
    title: ACTOR,
    body: copy.invitationAccepted,
    url: "/app",
    buttons: ["markRead"],
  }),
  IMPORT_FINISHED: (copy) => ({
    title: copy.importFinished.title("Trakt"),
    body: copy.importFinished.body,
    url: "/app/settings/import",
    buttons: ["markRead"],
  }),
  CHAT_MESSAGE: (copy) => ({
    title: ACTOR,
    body: copy.chatMessage,
    url: "/app",
    tag: "chat:sample",
    buttons: ["reply", "markRead"],
  }),
  COMMENT_REACTIONS: (copy) => ({
    title: copy.commentReactions.title,
    body: copy.commentReactions.body(10),
    url: WORK_URL,
    buttons: ["markRead"],
  }),
  REVIEW_VOTES: (copy) => ({
    title: copy.reviewVotes.title,
    body: copy.reviewVotes.body(10),
    url: WORK_URL,
    buttons: ["markRead"],
  }),
  // The release digest: one push for episodes, films and games alike.
  NEW_EPISODE: (copy) => ({
    title: "Loomkeep",
    body: copy.episodeDigestPush("daily", [WORK])[0]!,
    url: "/app/calendar",
  }),
  SAGA_SEQUEL_ANNOUNCED: (copy) => ({
    title: `${WORK} 3`,
    body: copy.sagaSequel(WORK),
    url: WORK_URL,
    buttons: ["planMedia"],
  }),
  PAUSED_REMINDER: (copy) => ({
    title: "Loomkeep",
    body: copy.pausedReminderPush(WORK, 3, 2),
    url: WORK_URL,
  }),
  ADMIN_REPORTS_PENDING: (copy) => ({
    ...copy.adminAlerts.reportsPending(3),
    url: "/app/admin/reports",
  }),
  ADMIN_JOB_FAILED: (copy) => ({
    ...copy.adminAlerts.jobFailed("release-scan"),
    url: "/app/admin/jobs",
  }),
  ADMIN_QUOTA: (copy) => ({
    ...copy.adminAlerts.quota("TMDB", 90),
    url: "/app/admin/services",
  }),
  ADMIN_NEW_USER: (copy) => ({
    ...copy.adminAlerts.newUser(ACTOR),
    url: "/app/admin/users",
  }),
  ADMIN_UPDATE_AVAILABLE: (copy) => ({
    ...copy.adminAlerts.updateAvailable("2.0.0"),
    url: "/app/admin/services",
  }),
};

/** The sample push of `key`, or null when it has none (not a push alert). */
export function samplePush(
  key: AlertKey,
  copy: NotificationCopy,
): PushPayload | null {
  const build = SAMPLES[key];
  if (!build) return null;
  const { buttons = [], ...push } = build(copy);

  return {
    ...push,
    group: ALERTS[key].group,
    actions: buttons.map((button): PushAction => ({
      action: NotificationAction.TEST,
      label: copy.pushActions[button],
      target: {},
      ...(button === "reply" && { replyHint: copy.pushActions.replyHint }),
    })),
  };
}
