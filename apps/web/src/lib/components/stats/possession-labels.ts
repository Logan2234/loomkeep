// Union of every domain's ownership status labels (see $lib/ownership-sources
// for the per-domain option lists these mirror) — the cross-domain
// possession breakdown combines statuses from all 4 domains, so it needs one
// merged label map rather than picking a single domain's.
import { m } from "$lib/paraglide/messages.js";

export const POSSESSION_STATUS_LABEL: Record<string, string> = {
  get PHYSICAL() {
    return m.ownership_physical();
  },
  get DIGITAL() {
    return m.ownership_digital();
  },
  get STREAMING() {
    return m.ownership_streaming();
  },
  get SUBSCRIPTION() {
    return m.ownership_subscription();
  },
  get AUDIO() {
    return m.ownership_audio();
  },
  get BORROWED() {
    return m.ownership_borrowed();
  },
};
