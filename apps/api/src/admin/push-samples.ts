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
const LIST = "Weekend";

/** What makes a sample look real: the recipient's picture, a work of the instance. */
export interface SampleContext {
  avatar: string | null;
  work: { title: string; url: string; poster: string | null };
}

const NO_CONTEXT: SampleContext = {
  avatar: null,
  work: { title: "Severance", url: "/app/media/series/95396", poster: null },
};

const person = ({ avatar }: SampleContext) =>
  avatar ? { image: avatar, imageKind: "person" as const } : {};

/**
 * Each alert's push as an account would get it (Admin › Communications),
 * built from the same copy as the real one, with stand-in names. Its
 * buttons carry the real labels but the TEST action: pressing one checks
 * the whole way to the API without accepting a request or sending a
 * message for real. `failing` has the server refuse them instead, to see how
 * a notification reports a failed action.
 */
const SAMPLES: Partial<
  Record<AlertKey, (copy: NotificationCopy, context: SampleContext) => Sample>
> = {
  COMMENT_REPLY: (copy, context) => ({
    ...person(context),
    title: copy.pushTitle.commentReply(ACTOR),
    body: `${context.work.title} 🔥`,
    url: context.work.url,
    buttons: ["reply", "markRead"],
  }),
  COMMENT_MENTION: (copy, context) => ({
    ...person(context),
    title: copy.pushTitle.commentMention(ACTOR),
    body: `${context.work.title} 🔥`,
    url: context.work.url,
    buttons: ["reply", "markRead"],
  }),
  FOLLOW_REQUEST: (copy, context) => ({
    ...person(context),
    title: ACTOR,
    body: copy.follow.requested,
    url: "/app",
    buttons: ["accept", "reject"],
  }),
  FOLLOW: (copy, context) => ({
    ...person(context),
    title: ACTOR,
    body: copy.follow.followed,
    url: "/app",
    buttons: ["followBack"],
  }),
  FOLLOW_ACCEPTED: (copy, context) => ({
    ...person(context),
    title: ACTOR,
    body: copy.follow.accepted,
    url: "/app",
    buttons: ["markRead"],
  }),
  LIST_MEMBER_ADDED: (copy, context) => ({
    ...person(context),
    title: ACTOR,
    body: copy.listEditorAdded(LIST),
    url: "/app/lists",
    buttons: ["markRead"],
  }),
  LIST_ITEM_ADDED: (copy, context) => ({
    ...person(context),
    title: ACTOR,
    body: copy.listItemAdded(context.work.title, LIST),
    url: "/app/lists",
    buttons: ["markRead"],
  }),
  INVITATION_ACCEPTED: (copy, context) => ({
    ...person(context),
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
  CHAT_MESSAGE: (copy, context) => ({
    ...person(context),
    conversationId: "sample",
    title: ACTOR,
    body: copy.chatMessage,
    url: "/app",
    tag: "chat:sample",
    buttons: ["reply", "markRead"],
  }),
  COMMENT_REACTIONS: (copy, context) => ({
    title: copy.commentReactions.title,
    body: copy.commentReactions.body(10),
    url: context.work.url,
    buttons: ["markRead"],
  }),
  REVIEW_VOTES: (copy, context) => ({
    title: copy.reviewVotes.title,
    body: copy.reviewVotes.body(10),
    url: context.work.url,
    buttons: ["markRead"],
  }),
  // The release digest: one push for episodes, films and games alike.
  NEW_EPISODE: (copy, context) => ({
    title: "Loomkeep",
    body: copy.episodeDigestPush("daily", [context.work.title])[0]!,
    url: "/app/calendar",
  }),
  SAGA_SEQUEL_ANNOUNCED: (copy, context) => ({
    ...(context.work.poster && {
      image: context.work.poster,
      imageKind: "work" as const,
    }),
    title: `${context.work.title} 3`,
    body: copy.sagaSequel(context.work.title),
    url: context.work.url,
    buttons: ["planMedia"],
  }),
  PAUSED_REMINDER: (copy, context) => ({
    title: "Loomkeep",
    body: copy.pausedReminderPush(context.work.title, 3, 2),
    url: context.work.url,
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
  context: SampleContext = NO_CONTEXT,
  { failing = false }: { failing?: boolean } = {},
): PushPayload | null {
  const build = SAMPLES[key];
  if (!build) return null;
  const { buttons = [], ...push } = build(copy, context);

  return {
    ...push,
    group: ALERTS[key].group,
    actions: buttons.map((button): PushAction => ({
      action: failing
        ? NotificationAction.TEST_FAILURE
        : NotificationAction.TEST,
      label: copy.pushActions[button],
      target: {},
      ...(button === "reply" && { replyHint: copy.pushActions.replyHint }),
    })),
  };
}
