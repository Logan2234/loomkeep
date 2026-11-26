// One-time e2e setup: apply migrations to the isolated "e2e" schema.
const { execSync } = require("node:child_process");
const path = require("node:path");
const dotenv = require("dotenv");

module.exports = async () => {
  const apiDir = path.join(__dirname, "..");
  const parsed =
    dotenv.config({ path: path.join(apiDir, ".env"), quiet: true }).parsed ??
    {};
  const baseUrl = process.env.DATABASE_URL ?? parsed.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL is required to run the e2e tests");
  }

  execSync("pnpm exec prisma migrate deploy", {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: baseUrl.replace(/schema=[^&]+/, "schema=e2e"),
    },
    stdio: "inherit",
  });
};
