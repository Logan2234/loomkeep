import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("archives byte-identical build files and removes maps from the public client directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "loomkeep-sourcemaps-"));

  try {
    const client = join(root, "client");
    const archive = join(root, "private");
    const relative = "_app/immutable/chunks/probe.js";
    const js = 'throw new Error("probe");\n//# sourceMappingURL=probe.js.map';
    const map = JSON.stringify({
      version: 3,
      sources: ["probe.ts"],
      sourcesContent: ["throw new Error('probe')"],
      mappings: "AAAA",
    });
    await mkdir(join(client, "_app/immutable/chunks"), { recursive: true });
    await writeFile(join(client, relative), js);
    await writeFile(join(client, `${relative}.map`), map);
    await writeFile(join(client, `${relative}.map.gz`), "compressed-map");
    await writeFile(join(client, `${relative}.map.br`), "compressed-map");
    await writeFile(join(client, "_app/immutable/chunks/probe.css"), "body {}");
    await writeFile(join(client, "_app/immutable/chunks/probe.css.map"), map);
    const result = spawnSync(
      process.execPath,
      [
        new URL("./prepare-sourcemaps.mjs", import.meta.url).pathname,
        client,
        archive,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(join(client, relative), "utf8"), js);
    assert.equal(await readFile(join(archive, relative), "utf8"), js);
    assert.equal(await readFile(join(archive, `${relative}.map`), "utf8"), map);
    await assert.rejects(access(join(client, `${relative}.map`)));
    await assert.rejects(access(join(client, `${relative}.map.gz`)));
    await assert.rejects(access(join(client, `${relative}.map.br`)));
    await assert.rejects(
      access(join(client, "_app/immutable/chunks/probe.css.map")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
