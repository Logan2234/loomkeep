import { m } from "#lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "#lib/paraglide/runtime.js";
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
          notification(type, "Texte de l'utilisateur", "Titre original"),
        ),
      ).toEqual({ title: "Titre original", body: "Texte de l'utilisateur" });
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

describe("list item added notification", () => {
  const added = (data: Record<string, unknown>): NotificationDto => ({
    ...notification("LIST_ITEM_ADDED", "a ajouté « Dune » à « SF »"),
    data,
  });

  it.each(["fr", "en"] as const)(
    "is worded in the reader's language (%s), not the persisted one",
    (locale) => {
      overwriteGetLocale(() => locale);
      expect(
        notificationText(added({ listTitle: "SF", itemTitle: "Dune" })),
      ).toEqual({
        title: "Alice",
        body: m.notif_list_item_added({ item: "Dune", list: "SF" }),
      });
    },
  );

  it("falls back to a generic line when the work couldn't be named", () => {
    expect(
      notificationText(added({ listTitle: "SF", itemTitle: null })).body,
    ).toBe(m.notif_list_item_added_generic({ list: "SF" }));
  });
});

describe("API key leaked notification", () => {
  it("names the revoked key in the reader's language", () => {
    expect(
      notificationText({
        ...notification("API_KEY_LEAKED", null, "Clé API révoquée"),
        data: { name: "Homepage" },
      }),
    ).toEqual({
      title: m.notif_api_key_leaked_title(),
      body: m.notif_api_key_leaked_body({ name: "Homepage" }),
    });
  });
});

describe("API keys review notification", () => {
  it("renders the active key count in the reader's language", () => {
    const review = (count: number) => ({
      ...notification("API_KEYS_REVIEW", null, "Vérifie tes clés API"),
      data: { count },
    });

    expect(notificationText(review(1))).toEqual({
      title: m.notif_api_keys_review_title(),
      body: m.notif_api_keys_review_one(),
    });
    expect(notificationText(review(3)).body).toBe(
      m.notif_api_keys_review_many({ count: "3" }),
    );
  });

  it("speaks of several titles once an editor's additions are grouped", () => {
    const added = {
      ...notification("LIST_ITEM_ADDED", "a ajouté 4 titres à « Top »"),
      data: { listTitle: "Top", count: 4 },
    };

    expect(notificationText(added).body).toBe(
      m.notif_list_items_added({ count: "4", list: "Top" }),
    );
  });

  it("names the import's source and whether it went through", () => {
    const finished = (failed: boolean) => ({
      ...notification("IMPORT_FINISHED", null, "Import TV Time terminé"),
      data: { source: "tvtime", failed },
    });

    expect(notificationText(finished(false)).title).toBe(
      m.notif_import_finished_title({ source: "TV Time" }),
    );
    expect(notificationText(finished(true)).title).toBe(
      m.notif_import_failed_title({ source: "TV Time" }),
    );
  });
});
