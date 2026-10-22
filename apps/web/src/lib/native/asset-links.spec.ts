import { describe, expect, it } from "vitest";
import { assetLinkStatements } from "./asset-links";

const RELEASE = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64";
const DEBUG = "aa:bb:cc";

describe("assetLinkStatements", () => {
  it("vouches for each package with all of its signing keys", () => {
    expect(
      assetLinkStatements(
        `app.loomkeep=${RELEASE}, app.loomkeep.debug=${DEBUG},app.loomkeep=11:22`,
      ),
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.loomkeep",
          sha256_cert_fingerprints: [RELEASE, "11:22"],
        },
      },
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.loomkeep.debug",
          sha256_cert_fingerprints: ["AA:BB:CC"],
        },
      },
    ]);
  });

  it("vouches for nothing when unset or malformed", () => {
    expect(assetLinkStatements(undefined)).toEqual([]);
    expect(assetLinkStatements("app.loomkeep, =AA")).toEqual([]);
  });
});
