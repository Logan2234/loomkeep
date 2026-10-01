import { INSTANCE_SETTING_ENV } from "@loomkeep/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The api container only sees the variables docker-compose.yml lists under
// its `environment`: one set in .env but missing there never reaches it,
// silently. These are the ones .env.example tells self-hosters to set.
const COMPOSE = readFileSync(
  join(__dirname, "../../../../docker/docker-compose.yml"),
  "utf-8",
);

describe("docker-compose.yml", () => {
  it.each([...Object.values(INSTANCE_SETTING_ENV), "ADMIN_EMAIL"])(
    "forwards %s to the api",
    (variable) => {
      expect(COMPOSE).toContain(`${variable}: \${${variable}:-}`);
    },
  );
});
