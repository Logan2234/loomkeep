import { Locale } from "@loomkeep/shared";
import { notificationCopy } from "./notification-copy";

describe("notificationCopy", () => {
  it("renders in the recipient's language", () => {
    expect(notificationCopy("fr").follow.followed).toBe("vous suit");
    expect(notificationCopy("en").follow.followed).toBe("follows you");
  });

  it("falls back to French for an unknown or missing locale", () => {
    // A notification must still be written: the locale column is free-form
    // enough that an unexpected value cannot be allowed to throw.
    expect(notificationCopy(undefined).follow.followed).toBe("vous suit");
    expect(notificationCopy("de").follow.followed).toBe("vous suit");
  });

  it("covers every supported locale", () => {
    // The bundle is `satisfies Record<Locale, …>`, so a new locale fails the
    // build — this guards the reverse: a locale silently dropped from Locale.
    for (const locale of Locale) {
      expect(notificationCopy(locale).moderation.other.length).toBeGreaterThan(
        0,
      );
    }
  });

  it("interpolates the values each message needs", () => {
    expect(notificationCopy("fr").commentReactions.body(5)).toContain("5");
    expect(notificationCopy("en").listEditorAdded("Mes classiques")).toContain(
      "Mes classiques",
    );
  });

  it("words the paused-works push by what's there to say", () => {
    const { pausedReminderPush } = notificationCopy("fr");

    expect(pausedReminderPush("Severance", 0, 0)).toBe(
      "« Severance » t'attend.",
    );
    expect(pausedReminderPush("Severance", 1, 1)).toBe(
      "« Severance » t'attend, et un épisode est sorti depuis. Une autre œuvre est en pause.",
    );
    expect(pausedReminderPush("Severance", 4, 2)).toBe(
      "« Severance » t'attend, et 4 épisodes sont sortis depuis. 2 autres œuvres sont en pause.",
    );
  });

  it("names the version in the update alert, in every language", () => {
    for (const locale of Locale) {
      const copy = notificationCopy(locale);
      expect(copy.adminAlerts.updateAvailable("1.12.0").body).toContain(
        "1.12.0",
      );
      expect(copy.pausedReminderPush("Dune", 3, 5)).toContain("Dune");
    }
  });
});
