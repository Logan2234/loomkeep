import { type FeatureBadgeKey } from "#lib/feature-badges.js";
import type { Domain } from "@loomkeep/shared";

type ImportSourceBase = {
  domain: Domain;
  label: string;
  description: string;
};

export type AvailableImportSourceDescriptor = ImportSourceBase & {
  comingSoon?: false;
  href: string;
  input: {
    type: "csv" | "xml" | "zip" | "steamId" | "username" | "oauth";
    accept?: string;
    placeholder?: string;
    textEncoding?: string;
    /**
     * Several files in one run (IMDb's ratings, watchlist and lists), sent as
     * a JSON array of `{ name, text }` — the name tells them apart.
     */
    multiple?: boolean;
  };
  noun: {
    one: string;
    many: string;
  };
  newBadgeKey?: FeatureBadgeKey;
  /** The docs page walking through this source's import. */
  guide?: string;
};

export type ImportSourceDescriptor =
  | AvailableImportSourceDescriptor
  | (ImportSourceBase & { comingSoon: true; newBadgeKey?: FeatureBadgeKey });
