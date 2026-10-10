import { copyFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const [client, archive] = process.argv.slice(2);

if (!client || !archive)
  throw new Error("Usage: prepare-sourcemaps.mjs CLIENT ARCHIVE");

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith(".map")) {
      const destination = join(archive, relative(client, path));
      await mkdir(dirname(destination), { recursive: true });
      // Archive the actual generated JS alongside its map for release upload.
      // Maps stay in the image, outside adapter-node's public asset directory.
      await copyFile(path.slice(0, -4), destination.slice(0, -4));
      await rename(path, destination);
      // Also remove any precompressed copies an adapter may generate.
      await rm(`${path}.gz`, { force: true });
      await rm(`${path}.br`, { force: true });
    }
  }
}

await visit(client);
