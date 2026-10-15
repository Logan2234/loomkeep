import { formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import type { IconName } from "#lib/types/icon-name.js";
import {
  IMPORT_SOURCE_NAMES,
  ModerationMeasure,
  NotificationType,
  type ImportSource,
  type NotificationDto,
} from "@loomkeep/shared";

export interface NotificationView {
  /** Whoever caused it: shown as their avatar, their name leading the line. */
  actor: { username: string; name: string } | null;
  /** The glyph on the actor's avatar, or the tile standing in for one. */
  icon: IconName;
  /** "warning" for what needs a look (a key, a moderation decision). */
  tone: "accent" | "warning" | "plain";
  /** The line after the actor's name, or the whole line without one. */
  text: string;
  body: string | null;
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;
const num = (value: unknown, fallback: number): number =>
  typeof value === "number" ? value : fallback;

/**
 * How an entry reads. Worded from its `data`, in the reader's current
 * language; only what people wrote (names, titles, a comment's excerpt, a
 * moderation reason) comes through as stored.
 */
export function notificationView(n: NotificationDto): NotificationView {
  const d = n.data;
  const username = str(d.actorUsername);
  const actor = username
    ? { username, name: str(d.actorDisplayName) ?? n.title }
    : null;
  const by = (icon: IconName, text: string, body: string | null = null) => ({
    actor,
    icon,
    tone: "accent" as const,
    text,
    body,
  });
  const about = (
    icon: IconName,
    text: string,
    body: string | null = null,
    tone: NotificationView["tone"] = "accent",
  ) => ({ actor: null, icon, tone, text, body });
  const work = str(d.workTitle);

  switch (n.type) {
    case NotificationType.FOLLOW:
      return by("user-plus", m.notif_follow());
    case NotificationType.FOLLOW_ACCEPTED:
      return by("user-check", m.notif_follow_accepted_body());
    case NotificationType.COMMENT_REPLY:
      return by(
        "reply",
        work
          ? m.notif_comment_reply({ work })
          : m.notif_comment_reply_generic(),
        n.body,
      );
    case NotificationType.COMMENT_MENTION:
      return by(
        "at",
        work
          ? m.notif_comment_mention({ work })
          : m.notif_comment_mention_generic(),
        n.body,
      );

    case NotificationType.LIST_ITEM_ADDED: {
      const list = str(d.listTitle) ?? "";
      const item = str(d.itemTitle);
      const count = num(d.count, 1);
      return by(
        "list-plus",
        count > 1
          ? m.notif_list_items_added({ count: formatNumber(count), list })
          : item
            ? m.notif_list_item_added({ item, list })
            : m.notif_list_item_added_generic({ list }),
      );
    }

    case NotificationType.LIST_MEMBER_ADDED: {
      const title = str(d.listTitle);
      return by(
        "edit",
        title ? m.notif_list_editor({ title }) : m.notif_list_editor_generic(),
      );
    }

    case NotificationType.INVITATION_ACCEPTED:
      return by("ticket", m.notif_invitation_accepted_body());

    case NotificationType.SAGA_SEQUEL_ANNOUNCED:
      return about(
        "clapperboard",
        m.notif_saga_sequel_title({ work: n.title }),
        m.notif_saga_sequel_body({ saga: str(d.sagaTitle) ?? "" }),
      );

    case NotificationType.COMMENT_REACTIONS: {
      const count = num(d.count, 0);
      return about(
        "heart",
        work ? m.notif_reactions_on({ work }) : m.notif_reactions_title(),
        count === 1
          ? m.notif_reaction_one({ count: formatNumber(count) })
          : m.notif_reactions_many({ count: formatNumber(count) }),
      );
    }

    case NotificationType.REVIEW_VOTES:
      return about(
        "thumbs-up",
        work ? m.notif_review_votes_on({ work }) : m.notif_review_votes_title(),
        m.notif_review_votes_body({ count: formatNumber(num(d.count, 0)) }),
      );

    case NotificationType.IMPORT_FINISHED: {
      const id = str(d.source) ?? "";
      const source = IMPORT_SOURCE_NAMES[id as ImportSource] ?? id;
      return d.failed === true
        ? about(
            "download",
            m.notif_import_failed_title({ source }),
            m.notif_import_failed_body(),
            "warning",
          )
        : about(
            "download",
            m.notif_import_finished_title({ source }),
            m.notif_import_finished_body(),
            "plain",
          );
    }

    case NotificationType.API_KEYS_REVIEW: {
      const count = num(d.count, 1);
      return about(
        "key",
        m.notif_api_keys_review_title(),
        count === 1
          ? m.notif_api_keys_review_one()
          : m.notif_api_keys_review_many({ count: formatNumber(count) }),
        "warning",
      );
    }

    case NotificationType.API_KEY_LEAKED:
      return about(
        "key",
        m.notif_api_key_leaked_title(),
        m.notif_api_key_leaked_body({ name: str(d.name) ?? "" }),
        "warning",
      );

    case NotificationType.API_KEY_EXPIRING:
      return about(
        "key",
        m.notif_api_key_expiring_title(),
        m.notif_api_key_expiring_body({ name: str(d.name) ?? "" }),
        "warning",
      );

    case NotificationType.REPORT_RESOLVED:
      return about(
        "flag",
        m.notif_report_title(),
        d.outcome === "RESOLVED"
          ? m.notif_report_action()
          : m.notif_report_dismissed(),
        "plain",
      );

    case NotificationType.MODERATION_ACTION:
      return about("shield", moderationTitle(d.measure), n.body, "warning");

    default:
      // A kind added on the API before the web knows it: as stored.
      return about("bell", n.title, n.body);
  }
}

function moderationTitle(measure: unknown): string {
  switch (measure) {
    case ModerationMeasure.COMMENT_REMOVED:
      return m.notif_comment_removed();
    case ModerationMeasure.MESSAGE_REMOVED:
      return m.notif_moderation_message_removed();
    case ModerationMeasure.REVIEW_REMOVED:
      return m.notif_moderation_review_removed();
    case ModerationMeasure.LIST_REMOVED:
      return m.notif_moderation_list_removed();
    case ModerationMeasure.LIST_EDITED:
      return m.notif_moderation_list_edited();
    case ModerationMeasure.AVATAR_REMOVED:
    case ModerationMeasure.BIO_CLEARED:
    case ModerationMeasure.DISPLAY_NAME_CHANGED:
      return m.notif_moderation_profile_edited();
    case ModerationMeasure.ACCOUNT_SUSPENDED:
      return m.notif_moderation_suspended();
    default:
      return m.notif_moderation_title();
  }
}
