import { inflateRawSync } from "node:zlib";

/**
 * Minimal, dependency-free ZIP reader for the TV Time GDPR export.
 *
 * The browser cannot unzip a ZIP container natively, so the web uploads the
 * raw archive (base64) and we extract the handful of CSVs we need here. In the
 * spirit of the hand-rolled CSV parser (see `csv.ts`), we avoid a runtime
 * dependency: Node's `zlib` handles the DEFLATE payload and we walk the ZIP
 * structures ourselves.
 *
 * We drive extraction from the **central directory** (the sizes/method there
 * are authoritative even when local headers use a streaming data descriptor)
 * and only read each local header to locate where its data starts.
 */

const EOCD_SIGNATURE = 0x06054b50; // End Of Central Directory record.
const CENTRAL_SIGNATURE = 0x02014b50; // Central directory file header.
const LOCAL_SIGNATURE = 0x04034b50; // Local file header.

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const ZIP64_SENTINEL = 0xffffffff;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * Extract, decoded as UTF-8 text, the entries whose base name is in `wanted`
 * (case-insensitive). Names in `wanted` and inside the archive are compared by
 * base name only, so a top-level folder in the export does not matter.
 */
export function readZipEntries(
  buf: Buffer,
  wanted: Set<string>,
): Map<string, string> {
  const wantedLower = new Set([...wanted].map((n) => n.toLowerCase()));
  const result = new Map<string, string>();
  let extractedBytes = 0;

  for (const entry of readCentralDirectory(buf)) {
    const base = baseName(entry.name).toLowerCase();
    if (!wantedLower.has(base) || result.has(base)) continue;
    const decoded = decodeEntry(
      buf,
      entry,
      MAX_TOTAL_UNCOMPRESSED_BYTES - extractedBytes,
    );
    extractedBytes += decoded.length;
    result.set(base, decoded.toString("utf8"));
  }

  return result;
}

/**
 * Extract, decoded as UTF-8 text, every entry whose base name (lowercased)
 * satisfies `predicate` — for an export that splits one logical file across
 * an unpredictable number of numbered parts (Trakt's `watched-history-N.json`
 * pagination), rather than the fixed set {@link readZipEntries} expects.
 */
export function readZipEntriesMatching(
  buf: Buffer,
  predicate: (baseNameLower: string) => boolean,
): Map<string, string> {
  const result = new Map<string, string>();
  let extractedBytes = 0;

  for (const entry of readCentralDirectory(buf)) {
    const base = baseName(entry.name).toLowerCase();
    if (!predicate(base)) continue;
    const decoded = decodeEntry(
      buf,
      entry,
      MAX_TOTAL_UNCOMPRESSED_BYTES - extractedBytes,
    );
    extractedBytes += decoded.length;
    result.set(base, decoded.toString("utf8"));
  }

  return result;
}

/** Walk the central directory, yielding one descriptor per stored file. */
function readCentralDirectory(buf: Buffer): CentralEntry[] {
  const eocd = findEocd(buf);
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  if (
    total === 0xffff ||
    cdSize === ZIP64_SENTINEL ||
    cdOffset === ZIP64_SENTINEL
  ) {
    throw new Error("ZIP64 archives are not supported");
  }

  const entries: CentralEntry[] = [];
  let pos = cdOffset;

  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(pos) !== CENTRAL_SIGNATURE) {
      throw new Error("Corrupt ZIP: bad central directory signature");
    }

    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);

    if (
      compressedSize === ZIP64_SENTINEL ||
      uncompressedSize === ZIP64_SENTINEL ||
      localHeaderOffset === ZIP64_SENTINEL
    ) {
      throw new Error("ZIP64 archives are not supported");
    }

    const name = buf.toString("utf8", pos + 46, pos + 46 + nameLen);
    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/** Locate an entry's compressed data and inflate/copy it into UTF-8 text. */
function decodeEntry(
  buf: Buffer,
  entry: CentralEntry,
  remainingBytes: number,
): Buffer {
  if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
    throw new Error(`ZIP entry ${entry.name} exceeds the uncompressed limit`);
  }

  if (entry.uncompressedSize > remainingBytes) {
    throw new Error("ZIP entries exceed the total uncompressed limit");
  }

  const lh = entry.localHeaderOffset;

  if (buf.readUInt32LE(lh) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt ZIP: bad local header for ${entry.name}`);
  }

  // The local header's own name/extra lengths can differ from the central one.
  const nameLen = buf.readUInt16LE(lh + 26);
  const extraLen = buf.readUInt16LE(lh + 28);
  const dataStart = lh + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > buf.length) {
    throw new Error(`Corrupt ZIP: truncated data for ${entry.name}`);
  }

  const data = buf.subarray(dataStart, dataEnd);

  if (entry.method === METHOD_STORED) return data;

  if (entry.method === METHOD_DEFLATE) {
    try {
      return inflateRawSync(data, {
        maxOutputLength: Math.min(MAX_ENTRY_UNCOMPRESSED_BYTES, remainingBytes),
      });
    } catch (error) {
      if (
        error instanceof RangeError ||
        (error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE")
      ) {
        throw new Error(
          `ZIP entry ${entry.name} exceeds the uncompressed limit`,
          { cause: error },
        );
      }

      throw error;
    }
  }

  throw new Error(
    `Unsupported ZIP compression method ${entry.method} for ${entry.name}`,
  );
}

/**
 * Find the End Of Central Directory record. It sits at the very end, but a
 * trailing comment (≤ 65535 bytes) can push it back, so scan that window.
 */
function findEocd(buf: Buffer): number {
  const minPos = Math.max(0, buf.length - (0xffff + 22));

  for (let pos = buf.length - 22; pos >= minPos; pos--) {
    if (buf.readUInt32LE(pos) === EOCD_SIGNATURE) return pos;
  }

  throw new Error("Not a ZIP archive: no end-of-central-directory record");
}

/** Last path segment, tolerating both `/` and `\` separators. */
function baseName(name: string): string {
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  return slash === -1 ? name : name.slice(slash + 1);
}
