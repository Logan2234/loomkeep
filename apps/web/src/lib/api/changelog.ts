import type { ChangelogEntryDto } from "@loomkeep/shared";
import { request } from "./core";

/** Public release notes, newest first — no auth required. */
export function getChangelog(): Promise<ChangelogEntryDto[]> {
  return request("/changelog", { withAuth: false });
}
