import { request } from "./core";

/**
 * "curious_cat" signal (see the [G3] plan) — fire-and-forget, the caller
 * never awaits this: the version-link click itself (opening the GitHub repo
 * in a new tab) must never be blocked or delayed by the network call. Not
 * wired through `typedRequest` (../generated/typed-request.ts) since that
 * needs the endpoint in the generated OpenAPI schema, and this is a plain
 * empty-body POST with nothing worth the codegen round-trip for.
 */
export function signalVersionLinkClicked(): void {
  request("/achievements/signals/version-link", { method: "POST" }).catch(
    () => {
      // Best-effort only — a failed signal just means curious_cat doesn't
      // unlock this time, nothing the user needs to see or retry.
    },
  );
}
