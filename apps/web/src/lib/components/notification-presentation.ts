import { formatNumber } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import {
  IMPORT_SOURCE_NAMES,
  NotificationType,
  type ImportSource,
  type NotificationDto,
} from "@loomkeep/shared";

/** Localize interface wording; actor names and user-authored content stay intact. */
export function notificationText(n: NotificationDto): {
  title: string;
  body: string | null;
} {
  switch (n.type) {
    case NotificationType.FOLLOW:
      return { title: n.title, body: m.profile_follows_you() };
    case NotificationType.FOLLOW_REQUEST:
      return { title: n.title, body: m.notif_follow_request_body() };
    case NotificationType.FOLLOW_ACCEPTED:
      return { title: n.title, body: m.notif_follow_accepted_body() };

    case NotificationType.COMMENT_REACTIONS: {
      // Persisted legacy rows contain the count only in this fixed server phrase.
      const count = n.body?.match(/^(\d+) réactions$/)?.[1];
      return {
        title: m.notif_reactions_title(),
        body:
          count === undefined
            ? null
            : Number(count) === 1
              ? m.notif_reaction_one({ count: formatNumber(Number(count)) })
              : m.notif_reactions_many({ count: formatNumber(Number(count)) }),
      };
    }

    case NotificationType.LIST_MEMBER_ADDED: {
      // Match only the known envelope, not prose inside the user-authored title.
      const title = n.body?.match(
        /^vous a ajouté comme éditeur sur « ([\s\S]*) »$/,
      )?.[1];
      return {
        title: n.title,
        body:
          title === undefined
            ? m.notif_list_editor_generic()
            : m.notif_list_editor({ title }),
      };
    }

    case NotificationType.LIST_ITEM_ADDED: {
      // Rendered from `data`, not from the persisted body, so the wording
      // follows the reader's current language.
      const list = typeof n.data.listTitle === "string" ? n.data.listTitle : "";
      const item =
        typeof n.data.itemTitle === "string" ? n.data.itemTitle : null;
      const count = typeof n.data.count === "number" ? n.data.count : 1;

      if (count > 1) {
        return {
          title: n.title,
          body: m.notif_list_items_added({ count: formatNumber(count), list }),
        };
      }

      return {
        title: n.title,
        body: item
          ? m.notif_list_item_added({ item, list })
          : m.notif_list_item_added_generic({ list }),
      };
    }

    case NotificationType.REPORT_RESOLVED:
      return {
        title: m.notif_report_title(),
        body:
          n.body === "Une mesure a été prise suite à ton signalement."
            ? m.notif_report_action()
            : n.body === "Nous n'avons pas donné suite à ton signalement."
              ? m.notif_report_dismissed()
              : null,
      };

    case NotificationType.API_KEYS_REVIEW: {
      const count = typeof n.data.count === "number" ? n.data.count : 1;
      return {
        title: m.notif_api_keys_review_title(),
        body:
          count === 1
            ? m.notif_api_keys_review_one()
            : m.notif_api_keys_review_many({ count: formatNumber(count) }),
      };
    }

    case NotificationType.API_KEY_LEAKED:
      return {
        title: m.notif_api_key_leaked_title(),
        body: m.notif_api_key_leaked_body({
          name: typeof n.data.name === "string" ? n.data.name : "",
        }),
      };

    case NotificationType.API_KEY_EXPIRING:
      return {
        title: m.notif_api_key_expiring_title(),
        body: m.notif_api_key_expiring_body({
          name: typeof n.data.name === "string" ? n.data.name : "",
        }),
      };

    case NotificationType.IMPORT_FINISHED: {
      const id = typeof n.data.source === "string" ? n.data.source : "";
      const source = IMPORT_SOURCE_NAMES[id as ImportSource] ?? id;
      return n.data.failed === true
        ? {
            title: m.notif_import_failed_title({ source }),
            body: m.notif_import_failed_body(),
          }
        : {
            title: m.notif_import_finished_title({ source }),
            body: m.notif_import_finished_body(),
          };
    }

    case NotificationType.SAGA_SEQUEL_ANNOUNCED:
      return {
        title: n.title,
        body: m.notif_saga_sequel_body({
          saga: typeof n.data.sagaTitle === "string" ? n.data.sagaTitle : "",
        }),
      };

    case NotificationType.INVITATION_ACCEPTED:
      return { title: n.title, body: m.notif_invitation_accepted_body() };

    case NotificationType.REVIEW_VOTES: {
      const count = typeof n.data.count === "number" ? n.data.count : 0;
      return {
        title: m.notif_review_votes_title(),
        body: m.notif_review_votes_body({ count: formatNumber(count) }),
      };
    }

    case NotificationType.MODERATION_ACTION:
      return {
        title:
          n.title === "Un de tes commentaires a été retiré"
            ? m.notif_comment_removed()
            : m.notif_moderation_title(),
        body: n.body,
      };
    default:
      // Episode titles, comment excerpts and unknown future content are data.
      return { title: n.title, body: n.body };
  }
}
