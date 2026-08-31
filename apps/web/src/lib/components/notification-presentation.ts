import { formatNumber } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import { NotificationType, type NotificationDto } from "@loomkeep/shared";

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
