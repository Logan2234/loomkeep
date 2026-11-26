import { existsSync } from "node:fs";
import { join } from "node:path";
import { prismaWrites, schemaModels } from "./test-utils/prisma-writes";

// A table is written by the module that owns it: the folder of src/ named
// like the prisma/schema/<module>.prisma file that declares it. Another
// module that needs to change it calls the owner (a writer such as
// users/user-url-token.writer.ts, a service) or publishes an event the
// owner listens to (docs/adr/0008-no-repository-layer.md). Reads are free.

/** Tables two modules genuinely share, beyond their owner. */
const CO_OWNERS: Record<string, string[]> = {
  // auth writes the credentials and second factors, account the deletion
  // and inactivity schedule, both columns of User.
  user: ["auth", "account"],
};

/**
 * Writes that predate the rule, each with why it crosses. The list only
 * shrinks: a new crossing goes through the owner instead, and an entry
 * that no longer matches a write fails the test until it is removed.
 */
const KNOWN_CROSSINGS: Record<string, { models: string[]; why: string }> = {
  "account/account-deletion.service.ts": {
    models: ["importRun", "invitation", "notification", "securityEvent"],
    why: "deleting an account detaches or drops its rows everywhere, in one transaction",
  },
  "account/data-export.service.ts": {
    models: ["userEntitlement"],
    why: "the export creates the default plan row it reports, inside its read transaction",
  },
  "admin/admin-reports.controller.ts": {
    models: ["user", "userAvatar"],
    why: "moderating a profile clears its avatar, bio or name and suspends it, in one transaction",
  },
  "admin/admin-users.controller.ts": {
    models: ["user"],
    why: "an admin changes a role and lifts a suspension",
  },
  "chat/work-thread.service.ts": {
    models: ["commentThreadRead"],
    why: "a work's thread in chat marks its comments read",
  },
  "gamification/achievements/achievement.service.ts": {
    models: ["user"],
    why: "the badge showcase is a User column (equippedBadgeKeys)",
  },
  "gamification/onboarding/onboarding.service.ts": {
    models: ["userOnboarding"],
    why: "the gamified onboarding records its completion beside the users module's steps",
  },
  "library/saga.service.ts": {
    models: ["sagaTranslation"],
    why: "the sagas view caches a film saga's translated title",
  },
  "lists/list.service.ts": {
    models: ["notification"],
    why: "removing a member drops the notification whose dedupe key would swallow a re-invitation",
  },
  "newsletter/newsletter.service.ts": {
    models: ["userConsent", "userPreferences"],
    why: "the one-click unsubscribe link turns the preference off and records it, without a session",
  },
  "notifications/notification.service.ts": {
    models: ["gameSagaMember", "sagaMember", "user"],
    why: "the sequel alert marks the saga member announced; the bell's seen time is a User column",
  },
  "security/security-event.service.ts": {
    models: [
      "consumedRefreshToken",
      "emailChangeRequest",
      "mfaLoginChallenge",
      "userToken",
      "webauthnChallenge",
    ],
    why: "the daily purge of expired auth secrets",
  },
  "social/follow.service.ts": {
    models: ["listMember", "listNotificationMute"],
    why: "blocking someone removes them from the blocker's lists, in the block's transaction",
  },
  "social/privacy.service.ts": {
    models: ["list", "user"],
    why: "the profile access is a User column, and going ghost makes shared lists private",
  },
  "work/entry-lifecycle.util.ts": {
    models: ["comment", "review"],
    why: "removing a work from the library drops the user's review and comments on it",
  },
};

describe("table ownership", () => {
  const models = schemaModels();
  const writes = prismaWrites();

  const crosses = ({ file, model }: { file: string; model: string }) => {
    const module = file.split("/")[0];
    return module !== models.get(model) && !CO_OWNERS[model]?.includes(module);
  };

  it("names each schema file after the module that owns its tables", () => {
    const owners = new Set(models.values());
    expect(
      [...owners].filter((owner) => !existsSync(join(__dirname, owner))),
    ).toEqual([]);
  });

  it("writes a table only from the module that owns it", () => {
    const offenders = writes
      .filter(crosses)
      .filter(
        ({ file, model }) => !KNOWN_CROSSINGS[file]?.models.includes(model),
      )
      .map(
        ({ file, line, model, op }) =>
          `${file}:${line} ${model}.${op} (owned by ${models.get(model)})`,
      );

    expect(offenders).toEqual([]);
  });

  it("lists no crossing that is gone", () => {
    const stale = Object.entries(KNOWN_CROSSINGS).flatMap(
      ([file, { models }]) =>
        models
          .filter(
            (model) =>
              !writes.some(
                (write) =>
                  write.file === file &&
                  write.model === model &&
                  crosses(write),
              ),
          )
          .map((model) => `${file} → ${model}`),
    );

    expect(stale).toEqual([]);
  });
});
