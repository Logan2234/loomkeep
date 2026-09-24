/**
 * Maintainer tool, run on the maintainer's machine only:
 *
 *   pnpm --filter @loomkeep/api ee:license sign <private-key.pem> <licensee> <expires-at>
 *   pnpm --filter @loomkeep/api ee:license keygen <private-key.pem>
 *
 * `sign` prints a key for LOOMKEEP_LICENSE_KEY. `keygen` creates a new signing
 * key pair and prints its public half, to paste into LICENSE_PUBLIC_KEY — which
 * invalidates every key issued so far, so it is only for a lost or leaked key.
 */
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { signLicenseKey } from "./license-key";

const [command, keyPath, licensee, expiresAt] = process.argv.slice(2);

if (command === "sign" && keyPath && licensee && expiresAt) {
  const expiry = new Date(expiresAt);

  if (Number.isNaN(expiry.getTime())) {
    throw new Error(`Not a date: ${expiresAt}`);
  }

  const privateKey = readFileSync(keyPath, "utf8");
  const key = signLicenseKey(
    { licensee, expiresAt: expiry.toISOString() },
    privateKey,
  );
  process.stdout.write(`${key}\n`);
} else if (command === "keygen" && keyPath) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
    flag: "wx",
  });
  process.stdout.write(publicKey.export({ type: "spki", format: "pem" }));
} else {
  console.error(
    "Usage: ee:license sign <private-key.pem> <licensee> <expires-at>\n" +
      "       ee:license keygen <private-key.pem>",
  );
  process.exit(1);
}
