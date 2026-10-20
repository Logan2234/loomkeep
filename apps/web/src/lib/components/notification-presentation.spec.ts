import { m } from "#lib/paraglide/messages.js";
import { getLocale, overwriteGetLocale } from "#lib/paraglide/runtime.js";
import type { NotificationDto } from "@loomkeep/shared";
import { afterEach, describe, expect, it } from "vitest";
import { notificationView } from "./notification-presentation";

const previousLocale = getLocale;
afterEach(() => overwriteGetLocale(previousLocale));

const notification = (
  type: string,
  data: Record<string, unknown> = {},
  over: Partial<NotificationDto> = {},
): NotificationDto => ({
  id: "1",
  type,
  title: "Alice",
  body: null,
  url: null,
  data,
  timestamp: "2026-08-31T00:00:00Z",
  createdAt: "2026-08-31T00:00:00Z",
  readAt: null,
  ...over,
});

const alice = { actorUsername: "alice", actorDisplayName: "Alice" };

describe("notification view", () => {
  it.each(["fr", "en"] as const)(
    "words an entry in the reader's language (%s), never the stored one",
    (locale) => {
      overwriteGetLocale(() => locale);

      expect(
        notificationView(notification("FOLLOW", alice, { body: "te suit" })),
      ).toEqual({
        actor: { username: "alice", name: "Alice" },
        icon: "user-plus",
        tone: "accent",
        text: m.notif_follow(),
        body: null,
      });
    },
  );

  it("names the work a reply or a mention is about, and keeps what was written", () => {
    const reply = notificationView(
      notification(
        "COMMENT_REPLY",
        { ...alice, workTitle: "Severance" },
        { body: "Complètement d'accord" },
      ),
    );
    expect(reply.text).toBe(m.notif_comment_reply({ work: "Severance" }));
    expect(reply.body).toBe("Complètement d'accord");

    expect(notificationView(notification("COMMENT_MENTION", alice)).text).toBe(
      m.notif_comment_mention_generic(),
    );
  });

  it("tells one title, several, or an unnamed one added to a list", () => {
    const added = (data: Record<string, unknown>) =>
      notificationView(notification("LIST_ITEM_ADDED", { ...alice, ...data }))
        .text;

    expect(added({ listTitle: "SF", itemTitle: "Dune" })).toBe(
      m.notif_list_item_added({ item: "Dune", list: "SF" }),
    );
    expect(added({ listTitle: "SF", count: 3 })).toBe(
      m.notif_list_items_added({ count: "3", list: "SF" }),
    );
    expect(added({ listTitle: "SF" })).toBe(
      m.notif_list_item_added_generic({ list: "SF" }),
    );
  });

  it("names the list someone made you an editor of", () => {
    expect(
      notificationView(
        notification("LIST_MEMBER_ADDED", { ...alice, listTitle: "À deux" }),
      ).text,
    ).toBe(m.notif_list_editor({ title: "À deux" }));
  });

  it("counts reactions and votes from the data", () => {
    const reactions = notificationView(
      notification(
        "COMMENT_REACTIONS",
        { count: 10, workTitle: "The Bear" },
        { title: "Ton commentaire fait réagir" },
      ),
    );
    expect(reactions).toMatchObject({
      actor: null,
      icon: "heart",
      text: m.notif_reactions_on({ work: "The Bear" }),
      body: m.notif_reactions_many({ count: "10" }),
    });

    expect(
      notificationView(notification("REVIEW_VOTES", { count: 10 })).text,
    ).toBe(m.notif_review_votes_title());
  });

  it("says whether a report led to something", () => {
    const report = (outcome: string) =>
      notificationView(notification("REPORT_RESOLVED", { outcome })).body;

    expect(report("RESOLVED")).toBe(m.notif_report_action());
    expect(report("DISMISSED")).toBe(m.notif_report_dismissed());
  });

  it("titles a moderation decision by its measure and keeps the reason", () => {
    const decision = (measure: string | null) =>
      notificationView(
        notification(
          "MODERATION_ACTION",
          { measure },
          { body: "Propos injurieux." },
        ),
      );

    expect(decision("REVIEW_REMOVED")).toMatchObject({
      tone: "warning",
      text: m.notif_moderation_review_removed(),
      body: "Propos injurieux.",
    });
    expect(decision("BIO_CLEARED").text).toBe(
      m.notif_moderation_profile_edited(),
    );
    expect(decision(null).text).toBe(m.notif_moderation_title());
  });

  it("flags an import that stopped", () => {
    expect(
      notificationView(
        notification("IMPORT_FINISHED", { source: "trakt", failed: true }),
      ),
    ).toMatchObject({
      tone: "warning",
      text: m.notif_import_failed_title({ source: "Trakt" }),
    });
  });

  it("shows a kind it doesn't know yet as stored", () => {
    expect(
      notificationView(
        notification("SOMETHING_NEW", {}, { title: "Titre", body: "Texte" }),
      ),
    ).toMatchObject({ actor: null, text: "Titre", body: "Texte" });
  });
});
