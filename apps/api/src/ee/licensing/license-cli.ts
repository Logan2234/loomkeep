/**
 * Maintainer tool, run on the maintainer's machine only:
 *
 *   pnpm --filter @loomkeep/api ee:license sign <private-key.pem> <licensee> <expires-at> [--instance]
 *   pnpm --filter @loomkeep/api ee:license keygen <private-key.pem>
 *
 * `sign` prints a key for LOOMKEEP_LICENSE_KEY; `--instance` makes it a
 * self-host key, which makes every account of the instance premium (leave it
 * out for the hosted instance, where premium is per account). `keygen` creates a new signing
 * key pair and prints its public half, to paste into LICENSE_PUBLIC_KEY — which
 * invalidates every key issued so far, so it is only for a lost or leaked key.
 */
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { signLicenseKey } from "./license-key";

const args = process.argv.slice(2);
const instanceWide = args.includes("--instance");
const [command, keyPath, licensee, expiresAt] = args.filter(
  (arg) => arg !== "--instance",
);

if (command === "sign" && keyPath && licensee && expiresAt) {
  const expiry = new Date(expiresAt);

  if (Number.isNaN(expiry.getTime())) {
    throw new Error(`Not a date: ${expiresAt}`);
  }

  const privateKey = readFileSync(keyPath, "utf8");
  const key = signLicenseKey(
    {
      licensee,
      expiresAt: expiry.toISOString(),
      ...(instanceWide ? { instanceWide: true } : {}),
    },
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
    "Usage: ee:license sign <private-key.pem> <licensee> <expires-at> [--instance]\n" +
      "       ee:license keygen <private-key.pem>",
  );
  process.exit(1);
}
