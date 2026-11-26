import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Each NestJS module sits in one layer and imports only modules of its own
// layer or below (docs/adr/0010-module-layers.md). A module that has to tell
// a higher layer something publishes an event (@nestjs/event-emitter)
// instead of importing it.
const LAYERS = [
  {
    name: "infra",
    modules: [
      "prisma/prisma.module",
      "config/config.module",
      "common/common.module",
      "metrics/metrics.module",
      "feature-flags/feature-flags.module",
      "instance-settings/instance-settings.module",
      "health/health.module",
      "quota/quota.module",
      "mail/mail.module",
      "events/events.module",
      "jobs/jobs.module",
      "auth/session-cache.module",
      "api-keys/api-key-auth.module",
      "notifications/admin-alert.module",
      "notifications/push.module",
    ],
  },
  {
    name: "platform",
    modules: [
      "entitlements/entitlements.module",
      "notifications/notifications.module",
      "security/security.module",
      "reports/reports.module",
      "gamification/gamification.module",
      "users/user-gates.module",
      "api-keys/api-keys.module",
      "auth/auth.module",
    ],
  },
  {
    name: "community",
    modules: [
      "social/social.module",
      "reviews/reviews.module",
      "comments/comments.module",
      "lists/lists.module",
      "chat/chat.module",
    ],
  },
  {
    name: "domains",
    modules: [
      "catalog/catalog.module",
      "library/library.module",
      "games/games.module",
      "books/books.module",
      "music/music.module",
    ],
  },
  {
    name: "cross-domain",
    modules: [
      "links/links.module",
      "lists/list-works.module",
      "session-timer/session-timer.module",
      "creators/creators.module",
      "search/search.module",
      "showcase/showcase.module",
      "stats/stats.module",
      "saved-views/saved-views.module",
      "newsletter/newsletter.module",
    ],
  },
  {
    name: "features",
    modules: [
      "account/account.module",
      "admin/admin.module",
      "chat/chat-api.module",
      "import/import.module",
      "public-api/public-api.module",
      "home-screen-widgets/home-screen-widgets.module",
      "notification-actions/notification-actions.module",
      "users/users.module",
      "ee/ee.module",
    ],
  },
] as const;

const LAYER_OF = new Map<string, number>(
  LAYERS.flatMap(({ modules }, index) =>
    modules.map((module) => [module, index] as const),
  ),
);
const layerName = (module: string) => LAYERS[LAYER_OF.get(module)!].name;

describe("module layers", () => {
  const modules = moduleFiles(__dirname).filter(
    (module) => module !== "app.module",
  );

  it("places every module in a layer", () => {
    expect(modules.filter((module) => !LAYER_OF.has(module))).toEqual([]);
  });

  it("imports only modules of the same layer or below", () => {
    const offenders = modules.flatMap((module) => {
      const source = readFileSync(join(__dirname, `${module}.ts`), "utf-8");
      return [...source.matchAll(/from\s+["'](\.{1,2}\/[^"']+\.module)["']/g)]
        .map((match) =>
          relative(__dirname, resolve(join(__dirname, module, ".."), match[1])),
        )
        .filter(
          (imported) =>
            LAYER_OF.has(imported) &&
            LAYER_OF.get(imported)! > LAYER_OF.get(module)!,
        )
        .map(
          (imported) =>
            `${module} (${layerName(module)}) imports ${imported} (${layerName(imported)})`,
        );
    });

    expect(offenders).toEqual([]);
  });
});

function moduleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return moduleFiles(full);
    return entry.name.endsWith(".module.ts")
      ? [relative(__dirname, full).replace(/\.ts$/, "")]
      : [];
  });
}
