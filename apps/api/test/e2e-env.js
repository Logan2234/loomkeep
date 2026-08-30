const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the e2e tests");
}

process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
  /schema=[^&]+/,
  "schema=e2e",
);
