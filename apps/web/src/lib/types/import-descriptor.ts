import { type FeatureBadgeKey } from "#lib/feature-badges.js";
import type { Domain } from "@loomkeep/shared";

export type ImportSourceDescriptor = {
  domain: Domain;
  label: string;
  description: string;
  href: string;
  input: {
    type: "csv" | "xml" | "zip" | "steamId" | "oauth";
    accept?: string;
    placeholder?: string;
    textEncoding?: string;
  };
  noun: {
    one: string;
    many: string;
  };
  newBadgeKey?: FeatureBadgeKey;
  /** The docs page walking through this source's import. */
  guide?: string;
};
