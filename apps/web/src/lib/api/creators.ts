import type { CreatorSource } from "@loomkeep/shared";
import { getLocale } from "../paraglide/runtime.js";
import { typedRequest } from "./generated/typed-request";

/** A person's page: identity and works, each with the viewer's status. */
export const getPersonPage = (source: CreatorSource, id: string) =>
  typedRequest("/creators/{source}/person/{id}", {
    params: { source, id },
    query: { lang: getLocale() },
  });
