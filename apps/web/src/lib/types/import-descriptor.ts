import type { Domain } from "@loomkeep/shared";

export type ImportSourceDescriptor = {
  domain: Domain;
  label: string;
  description: string;
  href: string;
  input: {
    type: "csv" | "zip" | "steamId";
    /** File `accept` attribute, for csv/zip inputs. */
    accept?: string;
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
