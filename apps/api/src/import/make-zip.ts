import { deflateRawSync } from "node:zlib";

/**
 * Test helper: build a minimal ZIP archive in memory. Not shipped at runtime
 * (excluded in tsconfig.build.json); lives next to the code it exercises so the
 * zip and import specs can share it. Each entry can be STORED (method 0) or
 * DEFLATE (method 8) to cover both decode paths.
 */
export function makeZip(
  entries: { name: string; content: string; method?: 0 | 8 }[],
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const method = entry.method ?? 8;
    const raw = Buffer.from(entry.content, "utf8");
    const data = method === 0 ? raw : deflateRawSync(raw);
    const name = Buffer.from(entry.name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(raw.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20); // compressed size
    central.writeUInt32LE(raw.length, 24); // uncompressed size
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const localBlock = Buffer.concat(locals);
  const centralBlock = Buffer.concat(centrals);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); // records on this disk
  eocd.writeUInt16LE(entries.length, 10); // total records
  eocd.writeUInt32LE(centralBlock.length, 12); // central directory size
  eocd.writeUInt32LE(localBlock.length, 16); // central directory offset

  return Buffer.concat([localBlock, centralBlock, eocd]);
}
