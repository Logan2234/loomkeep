// Union of every domain's ownership status labels (see $lib/ownership-sources
// for the per-domain option lists these mirror) — the cross-domain
// possession breakdown combines statuses from all 4 domains, so it needs one
// merged label map rather than picking a single domain's.
export const POSSESSION_STATUS_LABEL: Record<string, string> = {
  PHYSICAL: "Physique",
  DIGITAL: "Numérique",
  STREAMING: "Streaming",
  SUBSCRIPTION: "Abonnement",
  AUDIO: "Audio",
  BORROWED: "Emprunté",
};
