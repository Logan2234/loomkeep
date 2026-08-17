import type { Domain } from "@loomkeep/shared";

export type ImportSourceDescriptor = {
  domain: Domain;
  label: string;
  description: string;
  href: string;
  input: {
    // "oauth" sources never render the wizard's own input step: their own
    // page drives an external consent redirect and feeds the resulting code
    // into the wizard via `autoInput` — see SimklImportSource.
    type: "csv" | "zip" | "steamId" | "oauth";
    /** File `accept` attribute, for csv/zip inputs. */
    accept?: string;
    /** Placeholder for non-file inputs; falls back to a generic hint. */
    placeholder?: string;
  };
  noun: {
    one: string;
    many: string;
  };
  libraryHref: string;
  options?: {
    key: string;
    label: string;
    default: boolean;
  }[];
};
