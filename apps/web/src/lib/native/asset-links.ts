type AssetLinkStatement = {
  relation: ["delegate_permission/common.handle_all_urls"];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

/**
 * The Digital Asset Links statements Android checks before opening this
 * instance's links in the app (MOB-08), from ANDROID_APP_LINKS:
 * comma-separated `package=SHA-256 fingerprint` pairs, one per signing key
 * (the store build and the debug build are signed differently).
 */
export function assetLinkStatements(
  config: string | undefined,
): AssetLinkStatement[] {
  const fingerprints = new Map<string, string[]>();

  for (const pair of (config ?? "").split(",")) {
    const [packageName, fingerprint] = pair.split("=").map((s) => s.trim());
    if (!packageName || !fingerprint) continue;
    fingerprints.set(packageName, [
      ...(fingerprints.get(packageName) ?? []),
      fingerprint.toUpperCase(),
    ]);
  }

  return [...fingerprints].map(([packageName, keys]) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: packageName,
      sha256_cert_fingerprints: keys,
    },
  }));
}
