import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { PublicApiModule } from "./public-api.module";

export const PUBLIC_API_DOCUMENT_PATH = "/api/v1/openapi.json";

const DOCS_URL = "https://docs.loomkeep.app";

const DESCRIPTION = `Read a Loomkeep account from your own scripts and tools: its library, history, lists, calendar and stats.

Every request carries a personal API key, created in **Settings › Integrations**, as \`Authorization: Bearer lk_…\`.
New here? Start with the [quick start](${DOCS_URL}/api/), then [authentication](${DOCS_URL}/api/authentication/) and the [conventions](${DOCS_URL}/api/conventions/) every endpoint shares.`;

const TAGS: { name: string; description: string }[] = [
  {
    name: "Account",
    description: "The key in use and the account it belongs to.",
  },
  {
    name: "Library",
    description:
      "Everything tracked, across films, series, anime, games, books and music. Needs `library:read`.",
  },
  {
    name: "History",
    description:
      "What was watched, played, read and listened to, and when. Needs `library:read`.",
  },
  {
    name: "Calendar",
    description:
      "Upcoming episodes of the shows being followed. Needs `calendar:read`.",
  },
  {
    name: "Lists",
    description:
      "Lists the caller owns, and the ones shared with them to edit. Needs `lists:read`.",
  },
  {
    name: "Stats",
    description: "Counts and time spent, per domain. Needs `stats:read`.",
  },
  {
    name: "Reviews",
    description: "Reviews and ratings the caller wrote. Needs `reviews:read`.",
  },
  {
    name: "Profile",
    description:
      "The public profile, level and achievements. Needs `profile:read`.",
  },
  {
    name: "Notifications",
    description: "The notification bell. Needs `notifications:read`.",
  },
  {
    name: "Export",
    description:
      "The whole account in one JSON document, for backups. Needs `export:read`.",
  },
];

const TAG_GROUPS = [
  { name: "Your library", tags: ["Library", "History", "Calendar", "Lists"] },
  {
    name: "You",
    tags: ["Account", "Profile", "Stats", "Reviews", "Notifications"],
  },
  { name: "Your data", tags: ["Export"] },
];

// Shown by Scalar next to each value of an enum made only of these.
const ENUM_DESCRIPTIONS: Record<string, string> = {
  PLANNED: "Not started yet: planned, in the backlog, to read, to listen.",
  IN_PROGRESS: "Under way: watching, playing, reading.",
  DONE: "Finished: completed, up to date, read, listened.",
  DROPPED: "Given up.",
  EPISODE_WATCHED: "An episode seen.",
  MOVIE_WATCHED: "A film seen, first viewing or rewatch.",
  GAME_SESSION: "A play session logged.",
  GAME_COMPLETED: "A playthrough finished.",
  BOOK_SESSION: "A reading session logged.",
  BOOK_FINISHED: "A reading finished.",
  ALBUM_LISTENED: "An album listened to.",
  MEDIA: "Films, series and anime.",
  GAMES: "Video games.",
  BOOKS: "Books.",
  MUSIC: "Albums.",
  "auth.invalid_api_key":
    "The key is missing, malformed, unknown, expired or revoked.",
  "auth.api_key_forbidden": "The key wasn't granted this resource.",
  "api.disabled": "The instance has turned its public API off.",
  "api.rate_limited": "Too many requests: wait `Retry-After` seconds.",
  "validation.failed": "A parameter is invalid; `details` names it.",
  "user.domain_disabled": "That domain is turned off for the account.",
  "library.entry_not_found": "No such entry in the account's library.",
  "lists.not_found": "No such list, or one the account can't edit.",
  "gamification.feature_disabled":
    "Gamification is turned off on this instance.",
  "internal.error": "Something broke on the server; `requestId` helps find it.",
};

/**
 * The public API's contract alone: only PublicApiModule's controllers, so
 * internal routes never show up in what third parties read. Each instance
 * serves its own, matching the version it runs; the published one (docs
 * site) names a server whose host each reader can change to their own
 * instance.
 */
export function buildPublicApiDocument(
  app: INestApplication,
  version: string,
  server?: { defaultHost: string },
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle("Loomkeep API")
    .setDescription(DESCRIPTION)
    .setVersion(version)
    .setExternalDoc("Guides", `${DOCS_URL}/api/`)
    .setLicense("AGPL-3.0", "https://www.gnu.org/licenses/agpl-3.0.html")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "lk_…",
      description: "A personal API key, from Settings › Integrations.",
    })
    .addExtension("x-tagGroups", TAG_GROUPS);

  for (const tag of TAGS) builder.addTag(tag.name, tag.description);

  if (server) {
    builder.addServer("https://{instance}", "Your Loomkeep instance", {
      instance: {
        default: server.defaultHost,
        description: "The instance's host name, without https://.",
      },
    });
  }

  const document = SwaggerModule.createDocument(app, builder.build(), {
    include: [PublicApiModule],
  });
  describeEnums(document);
  return document;
}

function describeEnums(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(describeEnums);
    return;
  }

  if (!node || typeof node !== "object") return;
  const schema = node as Record<string, unknown>;

  if (
    Array.isArray(schema.enum) &&
    schema.enum.every(
      (value) => typeof value === "string" && value in ENUM_DESCRIPTIONS,
    )
  ) {
    schema["x-enumDescriptions"] = Object.fromEntries(
      (schema.enum as string[]).map((value) => [
        value,
        ENUM_DESCRIPTIONS[value],
      ]),
    );
  }

  Object.values(schema).forEach(describeEnums);
}
