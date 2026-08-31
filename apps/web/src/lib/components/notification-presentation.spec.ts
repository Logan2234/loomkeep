import { m } from "$lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "$lib/paraglide/runtime.js";
import type { NotificationDto } from "@loomkeep/shared";
import { afterEach, describe, expect, it } from "vitest";
import { notificationText } from "./notification-presentation";

const previousLocale = getLocale;
afterEach(() => overwriteGetLocale(previousLocale));
const notification = (
  type: string,
  body: string | null = null,
  title = "Alice",
): NotificationDto => ({
  id: "1",
  type,
  title,
  body,
  url: null,
  data: {},
  timestamp: "2026-08-31T00:00:00Z",
  createdAt: "2026-08-31T00:00:00Z",
});

describe("notification presentation", () => {
  it.each(["fr", "en"] as const)(
    "localizes social notifications in %s without altering names",
    (locale) => {
      overwriteGetLocale(() => locale);
      expect(notificationText(notification("FOLLOW", "vous suit"))).toEqual({
        title: "Alice",
        body: m.profile_follows_you(),
      });
      expect(
        notificationText(notification("FOLLOW_REQUEST", "souhaite vous suivre"))
          .body,
      ).toBe(m.notif_follow_request_body());
      expect(
        notificationText(
          notification("FOLLOW_ACCEPTED", "a accepté votre demande"),
        ).body,
      ).toBe(
        locale === "fr"
          ? "A accepté ta demande"
          : "Accepted your follow request",
      );
      expect(
        notificationText(
          notification(
            "COMMENT_REACTIONS",
            "10 réactions",
            "Ton commentaire fait réagir",
          ),
        ),
      ).toEqual({
        title: m.notif_reactions_title(),
        body: locale === "fr" ? "10 réactions" : "10 reactions",
      });
      expect(
        notificationText(notification("COMMENT_REACTIONS", "1 réactions")).body,
      ).toBe(locale === "fr" ? "1 réaction" : "1 reaction");
    },
  );

  it.each(["fr", "en"] as const)(
    "preserves list titles and moderation outcomes in %s",
    (locale) => {
      overwriteGetLocale(() => locale);
      const title = "Livres « à lire » — 日本語";
      expect(
        notificationText(
          notification(
            "LIST_MEMBER_ADDED",
            `vous a ajouté comme éditeur sur « ${title} »`,
          ),
        ).body,
      ).toBe(m.notif_list_editor({ title }));
      expect(
        notificationText(
          notification(
            "REPORT_RESOLVED",
            "Une mesure a été prise suite à ton signalement.",
          ),
        ),
      ).toEqual({
        title: m.notif_report_title(),
        body: m.notif_report_action(),
      });
      expect(
        notificationText(
          notification(
            "REPORT_RESOLVED",
            "Nous n'avons pas donné suite à ton signalement.",
          ),
        ).body,
      ).toBe(m.notif_report_dismissed());
      expect(
        notificationText(
          notification(
            "MODERATION_ACTION",
            "Motif rédigé par un modérateur",
            "Un de tes commentaires a été retiré",
          ),
        ),
      ).toEqual({
        title: m.notif_comment_removed(),
        body: "Motif rédigé par un modérateur",
      });
    },
  );

  it("does not translate user content or guess unrecognized legacy details", () => {
    overwriteGetLocale(() => "en");

    for (const type of [
      "COMMENT_REPLY",
      "COMMENT_MENTION",
      "NEW_EPISODE",
      "FUTURE_TYPE",
    ]) {
      expect(
        notificationText(
          notification(type, "Texte de l’utilisateur", "Titre original"),
        ),
      ).toEqual({ title: "Titre original", body: "Texte de l’utilisateur" });
    }

    expect(
      notificationText(notification("LIST_MEMBER_ADDED", "Unknown envelope"))
        .body,
    ).toBe(m.notif_list_editor_generic());
    expect(
      notificationText(notification("COMMENT_REACTIONS", "Unknown counter"))
        .body,
    ).toBeNull();
    expect(
      notificationText(notification("REPORT_RESOLVED", "Unknown outcome")).body,
    ).toBeNull();
  });
});
