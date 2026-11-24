const path = require("node:path");
const { randomBytes } = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the e2e tests");
}

process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
  /schema=[^&]+/,
  "schema=e2e",
);

// The suite drives real registrations and logins through the real guard, and
// every spec file doing so inside the same minute shares one budget. Raised
// here so the production limit (see src/auth/auth-throttle.ts) is set for
// production rather than for the tests.
process.env.AUTH_THROTTLE_LIMIT = "1000";

// MFA e2e flows need an instance key, never a production or committed secret.
process.env.MFA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

// Without a catalogue key, an instance doesn't offer that domain
// (instanceDomains); the suite never calls the real catalogues.
process.env.TMDB_API_TOKEN ??= "e2e";
process.env.TWITCH_CLIENT_ID ??= "e2e";
process.env.TWITCH_CLIENT_SECRET ??= "e2e";
